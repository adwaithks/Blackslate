import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { useSessionStore } from "@/store/sessions";

// Resolved once via Rust and cached for the process lifetime.
let homeDirCache: string | null = null;
async function getHomeDir(): Promise<string> {
	if (!homeDirCache) homeDirCache = await invoke<string>("get_home_dir");
	return homeDirCache;
}

// OSC 7 format: ESC ] 7 ; file://[host]/path BEL  or  ESC ] 7 ; ... ESC \
const OSC7_RE = /\x1b\]7;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

// CSI SP q (DECSCUSR) — shells set block/underline/bar; strip so xterm `cursorStyle` wins.
const DECSCUSR_RE = /\x1b\[[0-9;]* ?q/g;

function parseOsc7(chunk: string, homePath: string): string | null {
	OSC7_RE.lastIndex = 0;
	const match = OSC7_RE.exec(chunk);
	if (!match) return null;
	try {
		// new URL handles both file:///path and file://hostname/path correctly.
		const path = decodeURIComponent(new URL(match[1]).pathname);
		return path.startsWith(homePath)
			? "~" + path.slice(homePath.length)
			: path;
	} catch {
		return null;
	}
}

interface UsePtyOptions {
	terminal: Terminal | null;
	sessionId: string;
}

export function usePty({ terminal, sessionId }: UsePtyOptions) {
	const setCwd = useSessionStore((s) => s.setCwd);
	const setPtyId = useSessionStore((s) => s.setPtyId);
	const setClaudeCodeActive = useSessionStore((s) => s.setClaudeCodeActive);
	const resizeFnRef = useRef<(cols: number, rows: number) => void>(() => {});
	// Rolling buffer for OSC sequences that span chunk boundaries.
	const oscBufRef = useRef("");

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

		resizeFnRef.current = (cols: number, rows: number) => {
			if (!active) return;
			invoke("pty_resize", { id: ptyId, cols, rows }).catch(
				console.error,
			);
		};

		const run = async () => {
			const { cols, rows } = term;
			console.log(
				`[pty] setup start — id=${ptyId} cols=${cols} rows=${rows}`,
			);

			const home = await getHomeDir().catch(() => "");

			// Register data listener before creating the session so no output is missed.
			unlistenData = await listen<string>(
				`pty://data/${ptyId}`,
				(event) => {
					if (!active) return;
					const bytes = Uint8Array.from(atob(event.payload), (c) =>
						c.charCodeAt(0),
					);
					const chunk = new TextDecoder().decode(bytes);
					const withoutCursor = chunk.replace(DECSCUSR_RE, "");
					term.write(
						withoutCursor === chunk
							? bytes
							: new TextEncoder().encode(withoutCursor),
					);

					// OSC 7 cwd tracking — scan the decoded chunk plus any leftover buffer.
					oscBufRef.current += withoutCursor;
					// Keep the buffer bounded; retain only from the last ESC onwards.
					const lastEsc = oscBufRef.current.lastIndexOf("\x1b");
					const cwd = parseOsc7(oscBufRef.current, home);
					oscBufRef.current =
						lastEsc !== -1 ? oscBufRef.current.slice(lastEsc) : "";
					if (cwd !== null) setCwd(sessionId, cwd);
				},
			);

			unlistenExit = await listen<null>(`pty://exit/${ptyId}`, () => {
				term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
			});

			// Bail if cleanup ran while we were awaiting.
			if (!active) {
				unlistenData?.();
				unlistenExit?.();
				console.log(`[pty] aborted before create — id=${ptyId}`);
				return;
			}

			console.log(`[pty] invoking pty_create — id=${ptyId}`);
			await invoke("pty_create", { id: ptyId, cols, rows });
			console.log(`[pty] session created — id=${ptyId}`);

			if (!active) {
				invoke("pty_close", { id: ptyId }).catch(() => {});
				return;
			}

			setPtyId(sessionId, ptyId);

			const pollClaude = async () => {
				if (!active) return;
				try {
					const on = await invoke<boolean>("pty_claude_code_active", {
						id: ptyId,
					});
					setClaudeCodeActive(sessionId, on);
				} catch {
					setClaudeCodeActive(sessionId, false);
				}
			};
			await pollClaude();
			pollTimer = setInterval(pollClaude, 1000);

			// Wire keystrokes → PTY.
			onDataDisposable = term.onData((data) => {
				if (!active) return;
				invoke("pty_write", { id: ptyId, data }).catch((err) =>
					console.error("[pty_write]", err),
				);
			});

			// Re-focus after async setup so the user can type immediately.
			term.focus();
			console.log(`[pty] ready — id=${ptyId}`);
		};

		run().catch((err) => {
			console.error("[pty] setup error:", err);
			// Write the error visibly into the terminal so it's obvious if pty_create failed.
			if (active) {
				term.writeln(`\r\n\x1b[31m[slate error] ${err}\x1b[0m`);
			}
		});

		return () => {
			active = false;
			if (pollTimer !== null) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			setClaudeCodeActive(sessionId, false);
			setPtyId(sessionId, null);
			resizeFnRef.current = () => {};
			oscBufRef.current = "";
			onDataDisposable?.dispose();
			unlistenData?.();
			unlistenExit?.();
			invoke("pty_close", { id: ptyId }).catch(() => {});
			console.log(`[pty] cleanup — id=${ptyId}`);
		};
	}, [terminal, sessionId, setCwd, setPtyId, setClaudeCodeActive]);

	return { sendResize };
}
