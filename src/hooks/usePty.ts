import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { findSession, useSessionStore } from "@/store/sessions";
import {
	claudeLifecycleFromOsc6974Payload,
	cwdFromOsc7Payload,
	isClaudeProductWindowTitle,
	shellStateFromOsc6973Payload,
	stripClaudeWindowTitlePrefix,
} from "@/lib/ptyStreamOsc";

// ---------------------------------------------------------------------------
// Home dir — fetched once, shared across all callers.
// ---------------------------------------------------------------------------

// Promise-cached so concurrent callers share the single Tauri round-trip.
let homeDirPromise: Promise<string> | null = null;
export function getHomeDir(): Promise<string> {
	if (!homeDirPromise) homeDirPromise = invoke<string>("get_home_dir");
	return homeDirPromise;
}

interface UsePtyOptions {
	terminal: Terminal | null;
	sessionId: string;
}

export function usePty({ terminal, sessionId }: UsePtyOptions) {
	const setCwd = useSessionStore((s) => s.setCwd);
	const setPtyId = useSessionStore((s) => s.setPtyId);
	const setClaudeCodeActive = useSessionStore((s) => s.setClaudeCodeActive);
	const setClaudeState = useSessionStore((s) => s.setClaudeState);
	const setClaudeSessionTitle = useSessionStore(
		(s) => s.setClaudeSessionTitle,
	);
	const setClaudeModel = useSessionStore((s) => s.setClaudeModel);
	const setShellState = useSessionStore((s) => s.setShellState);
	const resizeFnRef = useRef<(cols: number, rows: number) => void>(() => {});

	const sendResize = useCallback((cols: number, rows: number) => {
		resizeFnRef.current(cols, rows);
	}, []);

	useEffect(() => {
		if (!terminal) return;
		const term = terminal;

		// Fresh UUID per effect invocation — no cross-mount conflicts in StrictMode.
		const ptyId = crypto.randomUUID();
		let active = true;
		let unlistenData: UnlistenFn | null = null;
		let unlistenExit: UnlistenFn | null = null;
		let onDataDisposable: IDisposable | null = null;
		let oscDisposables: IDisposable[] = [];
		const ptyTextDecoder = new TextDecoder();
		let pollTimer: ReturnType<typeof setInterval> | null = null;
		// Fit / ResizeObserver can run while `run()` is awaiting; PTY is not in Rust yet.
		let ptyRegistered = false;

		resizeFnRef.current = (cols: number, rows: number) => {
			if (!active || !ptyRegistered) return;
			invoke("pty_resize", { id: ptyId, cols, rows }).catch(
				console.error,
			);
		};

		// True after we see Claude-specific OSC (6974 or titled session); gates OSC 0 session names.
		// Cleared when Claude sends an empty window title (explicit exit).
		let claudeOscActive = false;
		let lastSessionTitle: string | null = null;

		const clearClaudeOscState = () => {
			claudeOscActive = false;
			lastSessionTitle = null;
			setClaudeState(sessionId, null);
			setClaudeSessionTitle(sessionId, null);
			setClaudeModel(sessionId, null);
		};

		const run = async () => {
			const { cols, rows } = term;

			const home = await getHomeDir().catch(() => "");
			if (!active) return;

			// OSC side effects: xterm’s parser sees the same bytes as the screen (handles splits).
			oscDisposables = [
				term.parser.registerOscHandler(7, (data) => {
					const cwd = cwdFromOsc7Payload(data, home);
					if (cwd !== null) setCwd(sessionId, cwd);
					return true;
				}),
				term.parser.registerOscHandler(6973, (data) => {
					const st = shellStateFromOsc6973Payload(data);
					if (st === "running") setShellState(sessionId, "running");
					else if (st === "idle") setShellState(sessionId, "idle");
					return true;
				}),
				term.parser.registerOscHandler(6974, (data) => {
					const lifecycle = claudeLifecycleFromOsc6974Payload(data);
					if (lifecycle !== null) {
						claudeOscActive = true;
						setClaudeState(sessionId, lifecycle);
					}
					return true;
				}),
				term.parser.registerOscHandler(6977, (data) => {
					const m = data.trim();
					if (m) setClaudeModel(sessionId, m);
					return true;
				}),
				term.onTitleChange((rawTitle) => {
					if (rawTitle.length > 0) {
						const name = stripClaudeWindowTitlePrefix(rawTitle);
						if (isClaudeProductWindowTitle(name)) {
							claudeOscActive = true;
						} else if (
							name &&
							claudeOscActive &&
							name !== lastSessionTitle
						) {
							lastSessionTitle = name;
							setClaudeSessionTitle(sessionId, name);
						}
					} else if (claudeOscActive) {
						clearClaudeOscState();
					}
				}),
			];

			if (!active) {
				for (const d of oscDisposables) d.dispose();
				oscDisposables = [];
				return;
			}

			// Register data listener before creating the session so no output is missed.
			unlistenData = await listen<string>(
				`pty://data/${ptyId}`,
				(event) => {
					if (!active) return;

					const raw = atob(event.payload);
					const bytes = new Uint8Array(raw.length);
					for (let i = 0; i < raw.length; i++)
						bytes[i] = raw.charCodeAt(i);
					const chunk = ptyTextDecoder.decode(bytes, { stream: true });
					term.write(chunk);
				},
			);

			unlistenExit = await listen<null>(`pty://exit/${ptyId}`, () => {
				term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
			});

			// Bail if cleanup ran while we were awaiting.
			if (!active) {
				unlistenData?.();
				unlistenExit?.();
				for (const d of oscDisposables) d.dispose();
				oscDisposables = [];
				return;
			}

			const initialCwd =
				findSession(useSessionStore.getState().workspaces, sessionId)
					?.cwd ?? null;
			await invoke("pty_create", {
				id: ptyId,
				cols,
				rows,
				cwd: initialCwd,
			});

			if (!active) {
				invoke("pty_close", { id: ptyId }).catch(() => {});
				for (const d of oscDisposables) d.dispose();
				oscDisposables = [];
				return;
			}

			ptyRegistered = true;
			resizeFnRef.current(term.cols, term.rows);

			setPtyId(sessionId, ptyId);

			// Skip store writes when the polled value is unchanged (avoids UI churn every second).
			let lastClaudeActive: boolean | undefined;
			const pollClaude = async () => {
				if (!active) return;
				try {
					const on = await invoke<boolean>("pty_claude_code_active", {
						id: ptyId,
					});
					if (!active) return;
					if (on !== lastClaudeActive) {
						lastClaudeActive = on;
						setClaudeCodeActive(sessionId, on);
						if (!on) clearClaudeOscState();
					}
				} catch {
					if (!active) return;
					if (lastClaudeActive !== false) {
						lastClaudeActive = false;
						setClaudeCodeActive(sessionId, false);
						clearClaudeOscState();
					}
				}
			};
			await pollClaude();
			pollTimer = setInterval(pollClaude, 1000);

			onDataDisposable = term.onData((data) => {
				if (!active) return;
				invoke("pty_write", { id: ptyId, data }).catch((err) =>
					console.error("[pty_write]", err),
				);
			});

			term.focus();
		};

		run().catch((err) => {
			console.error("[pty] setup error:", err);
			if (active) {
				term.writeln(`\r\n\x1b[31m[blackslate error] ${err}\x1b[0m`);
			}
		});

		return () => {
			active = false;
			ptyTextDecoder.decode(new Uint8Array(), { stream: false });
			for (const d of oscDisposables) d.dispose();
			oscDisposables = [];
			if (pollTimer !== null) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			setClaudeCodeActive(sessionId, false);
			clearClaudeOscState();
			setPtyId(sessionId, null);
			resizeFnRef.current = () => {};
			onDataDisposable?.dispose();
			unlistenData?.();
			unlistenExit?.();
			invoke("pty_close", { id: ptyId }).catch(() => {});
		};
	}, [
		terminal,
		sessionId,
		setCwd,
		setPtyId,
		setClaudeCodeActive,
		setClaudeState,
		setClaudeSessionTitle,
		setClaudeModel,
		setShellState,
	]);

	return { sendResize };
}
