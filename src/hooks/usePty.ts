import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { findSession, useSessionStore } from "@/store/sessions";
import {
	pullOscSideEffects,
	stripClaudeWindowTitlePrefix,
	stripShellCursorShapeSequences,
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

// ---------------------------------------------------------------------------
// PTY data decoding — module-level to avoid per-chunk allocation.
// ---------------------------------------------------------------------------

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();

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
	const setCurrentTool = useSessionStore((s) => s.setCurrentTool);
	const setLastTurnUsage = useSessionStore((s) => s.setLastTurnUsage);
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
			setCurrentTool(sessionId, null);
		};

		const run = async () => {
			const { cols, rows } = term;

			const home = await getHomeDir().catch(() => "");

			// Register data listener before creating the session so no output is missed.
			unlistenData = await listen<string>(
				`pty://data/${ptyId}`,
				(event) => {
					if (!active) return;

					const raw = atob(event.payload);
					const bytes = new Uint8Array(raw.length);
					for (let i = 0; i < raw.length; i++)
						bytes[i] = raw.charCodeAt(i);
					const chunk = TEXT_DECODER.decode(bytes);

					// DECSCUSR: strip before paint so xterm cursor style wins (see `ptyStreamOsc.ts`).
					const withoutCursor = stripShellCursorShapeSequences(chunk);
					term.write(
						withoutCursor === chunk
							? bytes
							: TEXT_ENCODER.encode(withoutCursor),
					);

					for (const e of pullOscSideEffects(withoutCursor, home)) {
						switch (e.type) {
							case "shell_state":
								setShellState(sessionId, e.state);
								break;
							case "cwd":
								setCwd(sessionId, e.path);
								break;
							case "claude_lifecycle":
								claudeOscActive = true;
								setClaudeState(sessionId, e.lifecycle);
								break;
							case "tool_label":
								setCurrentTool(sessionId, e.label);
								break;
							case "session_model":
								setClaudeModel(sessionId, e.model);
								break;
							case "turn_usage":
								setLastTurnUsage(sessionId, e.usage);
								if (e.model) setClaudeModel(sessionId, e.model);
								break;
							case "window_title": {
								const rawTitle = e.raw;
								if (rawTitle.length > 0) {
									const name = stripClaudeWindowTitlePrefix(rawTitle);
									if (name === "Claude Code") {
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
								break;
							}
							default:
								break;
						}
					}
				},
			);

			unlistenExit = await listen<null>(`pty://exit/${ptyId}`, () => {
				term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
			});

			// Bail if cleanup ran while we were awaiting.
			if (!active) {
				unlistenData?.();
				unlistenExit?.();
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
		setCurrentTool,
		setLastTurnUsage,
	]);

	return { sendResize };
}
