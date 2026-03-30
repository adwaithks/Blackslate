import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IDisposable } from "@xterm/xterm";
import { findSession, useSessionStore } from "@/store/sessions";

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

// OSC 7 format: ESC ] 7 ; file://[host]/path BEL  or  ESC ] 7 ; ... ESC \
const OSC7_RE = /\x1b\]7;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

// OSC 0/2 window title — captures the title string.
const OSC_TITLE_RE = /\x1b\](?:0|2);([^\x07\x1b]*)(?:\x07|\x1b\\)/g;

// Braille spinner chars Claude Code cycles through while thinking/processing.
// These appear in the OSC 0 window title (⠂ ⠐ etc.), not in visible terminal output.
const BRAILLE_SPINNER_RE = /[⠂⠄⠆⠇⠏⠟⠿⠽⠹⠸⠼⠴⠤⠠⠐⠁]/;

// Strips any leading spinner/icon char + whitespace from a Claude Code OSC 0 title.
// e.g. "✳ New coding session" → "New coding session"
const TITLE_PREFIX_RE = /^[\s✳✻✽✶✢·⠂⠄⠆⠇⠏⠟⠿⠽⠹⠸⠼⠴⠤⠠⠐⠁]+/;

// Strips CSI sequences including private-mode variants (e.g. \x1b[?2026h).
const STRIP_CSI_RE = /\x1b\[[?!>]?[0-9;]*[A-Za-z]/g;

// Two patterns that surface the active model name, applied to CSI-stripped chunks:
//
//  DOT      — splash banner: "Sonnet4.6·ClaudePro"  (U+00B7 · separator)
//             Fires on first open. Model name has no space e.g. "Sonnet4.6".
//
//  CURRENTLY — /model switch confirmation in the autocomplete description line:
//              "Set the AI model for Claude Code (currently Sonnet 4.6)"
//             Also fires on first open when the hint is visible.
//             Model name already has a space e.g. "Sonnet 4.6".
const CLAUDE_MODEL_DOT_RE = /([A-Za-z][a-zA-Z0-9.]+)\u00B7Claude/;
const CLAUDE_MODEL_CURRENTLY_RE = /\(currently ([A-Za-z][a-zA-Z]+ \d+\.\d+)\)/;

// OSC 9;4;0 — ConEmu progress reset. Claude Code emits this when a response finishes.
// It also fires once at startup, so we only act on it when already in 'thinking' state.
const OSC9_PROGRESS_RESET_RE = /\x1b\]9;4;0;?(?:\x07|\x1b\\)/;

// CSI SP q (DECSCUSR) — shells set block/underline/bar; strip so xterm `cursorStyle` wins.
const DECSCUSR_RE = /\x1b\[[0-9;]* ?q/g;

// OSC buffer cap: OSC 7 sequences are short; 2 KB is enough to span any chunk boundary.
const MAX_OSC_BUF = 2048;

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
	const setClaudeState = useSessionStore((s) => s.setClaudeState);
	const setClaudeSessionTitle = useSessionStore(
		(s) => s.setClaudeSessionTitle,
	);
	const setClaudeModel = useSessionStore((s) => s.setClaudeModel);
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

		// Set to true when we've seen Claude-specific OSC signatures (spinner/title).
		// Guards setClaudeSessionTitle so shell window-title updates don't bleed in.
		// Cleared when Claude sends an empty title (its explicit exit signal).
		let claudeOscActive = false;
		// Tracks whether Claude is currently processing a response.
		let isThinking = false;
		// Last title written to the store — skips redundant writes on repeated OSC.
		let lastSessionTitle: string | null = null;

		// Resets all stream-parsed Claude state back to "not active".
		// Called on OSC exit signal, on poll exit, on poll error, and on cleanup.
		const clearClaudeOscState = () => {
			claudeOscActive = false;
			isThinking = false;
			lastSessionTitle = null;
			setClaudeState(sessionId, null);
			setClaudeSessionTitle(sessionId, null);
			setClaudeModel(sessionId, null);
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

					// Decode base64 → bytes without per-chunk allocations.
					const raw = atob(event.payload);
					const bytes = new Uint8Array(raw.length);
					for (let i = 0; i < raw.length; i++)
						bytes[i] = raw.charCodeAt(i);
					const chunk = TEXT_DECODER.decode(bytes);

					const withoutCursor = chunk.replace(DECSCUSR_RE, "");
					term.write(
						withoutCursor === chunk
							? bytes
							: TEXT_ENCODER.encode(withoutCursor),
					);

					// OSC 7 cwd tracking — scan the decoded chunk plus any leftover buffer,
					// bounded to MAX_OSC_BUF to prevent unbounded growth on ESC-free output.
					const combined = oscBufRef.current + withoutCursor;
					const buf =
						combined.length > MAX_OSC_BUF
							? combined.slice(-MAX_OSC_BUF)
							: combined;
					const cwd = parseOsc7(buf, home);
					const lastEsc = buf.lastIndexOf("\x1b");
					oscBufRef.current = lastEsc !== -1 ? buf.slice(lastEsc) : "";
					if (cwd !== null) setCwd(sessionId, cwd);

					// Claude state — scan the current chunk only so stale sequences in the
					// rolling buffer don't re-trigger state transitions after they've fired.
					//
					// Primary signal: title switches from braille spinner (thinking) to
					// non-braille (done). OSC 9;4;0 is a secondary fallback — it fires
					// inconsistently across Claude Code versions.
					OSC_TITLE_RE.lastIndex = 0;
					let titleMatch: RegExpExecArray | null;
					while (
						(titleMatch = OSC_TITLE_RE.exec(withoutCursor)) !== null
					) {
						const title = titleMatch[1];
						if (BRAILLE_SPINNER_RE.test(title)) {
							// Braille spinner → Claude is definitely active and thinking.
							claudeOscActive = true;
							if (!isThinking) {
								isThinking = true;
								setClaudeState(sessionId, "thinking");
							}
						} else if (title.length > 0) {
							// Non-empty, non-spinner title.
							const name = title.replace(TITLE_PREFIX_RE, "");
							if (name === "Claude Code") {
								// Idle app title — mark OSC active but don't set a session name.
								claudeOscActive = true;
							} else if (
								name &&
								claudeOscActive &&
								name !== lastSessionTitle
							) {
								// AI-generated session name — only store while Claude is active.
								lastSessionTitle = name;
								setClaudeSessionTitle(sessionId, name);
							}
							if (isThinking) {
								// Title switched from spinner to steady — response done.
								isThinking = false;
								setClaudeState(sessionId, "waiting");
							}
						} else {
							// Empty title: Claude's explicit exit signal — clear immediately.
							if (claudeOscActive) clearClaudeOscState();
						}
					}

					// OSC 9;4;0 — fallback: progress reset also signals response done.
					if (
						isThinking &&
						OSC9_PROGRESS_RESET_RE.test(withoutCursor)
					) {
						isThinking = false;
						setClaudeState(sessionId, "waiting");
					}

					// Model name — two patterns checked on every chunk:
					//   CURRENTLY: autocomplete hint "(currently Sonnet 4.6)" — fires on
					//              first open AND after every /model switch. Most reliable.
					//   DOT: splash banner "Sonnet4.6·Claude" — fallback for first open.
					{
						const stripped = chunk.replace(STRIP_CSI_RE, "");
						const mCurrent = CLAUDE_MODEL_CURRENTLY_RE.exec(stripped);
						const mDot = mCurrent ? null : CLAUDE_MODEL_DOT_RE.exec(stripped);
						const m = mCurrent ?? mDot;
						if (m) {
							// CURRENTLY already has a space e.g. "Sonnet 4.6".
							// DOT does not e.g. "Sonnet4.6" → insert space before digit.
							const raw = m[1];
							const name = mCurrent
								? raw
								: raw.replace(/([A-Za-z])(\d)/, "$1 $2");
							setClaudeModel(sessionId, name);
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
				console.log(`[pty] aborted before create — id=${ptyId}`);
				return;
			}

			const initialCwd =
				findSession(useSessionStore.getState().workspaces, sessionId)
					?.cwd ?? null;
			console.log(`[pty] invoking pty_create — id=${ptyId} cwd=${initialCwd}`);
			await invoke("pty_create", {
				id: ptyId,
				cols,
				rows,
				cwd: initialCwd,
			});
			console.log(`[pty] session created — id=${ptyId}`);

			if (!active) {
				invoke("pty_close", { id: ptyId }).catch(() => {});
				return;
			}

			setPtyId(sessionId, ptyId);

			// Track last-known value to skip store writes when nothing changed,
			// preventing spurious re-renders in subscribed components every poll tick.
			let lastClaudeActive: boolean | undefined;
			const pollClaude = async () => {
				if (!active) return;
				try {
					const on = await invoke<boolean>("pty_claude_code_active", {
						id: ptyId,
					});
					if (on !== lastClaudeActive) {
						lastClaudeActive = on;
						setClaudeCodeActive(sessionId, on);
						// Clear stream-parsed state when Claude exits so stale
						// 'thinking'/'waiting' indicators don't linger.
						if (!on) clearClaudeOscState();
					}
				} catch {
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

			// Re-focus after async setup so the user can type immediately.
			term.focus();
			console.log(`[pty] ready — id=${ptyId}`);
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
			oscBufRef.current = "";
			onDataDisposable?.dispose();
			unlistenData?.();
			unlistenExit?.();
			invoke("pty_close", { id: ptyId }).catch(() => {});
			console.log(`[pty] cleanup — id=${ptyId}`);
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
	]);

	return { sendResize };
}
