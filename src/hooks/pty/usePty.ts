import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { findTerminal, useTerminalStore } from "@/store/terminals";
import { decodePtyBase64PayloadChunk } from "@/lib/decodePtyBase64PayloadChunk";
import { getHomeDir } from "@/lib/getHomeDir";
import { toastError, toastErrorThrottled } from "@/lib/toastError";
import { registerPtyOscHandlers } from "./registerPtyOscHandlers";
import {
	abortAfterListeners,
	abortAfterPtyCreate,
	createPtyEffectState,
	teardownPtyEffect,
	type PtyEffectState,
} from "./ptyEffectState";

// Some code still imports home-folder helper from here.
export { getHomeDir } from "@/lib/getHomeDir";

interface UsePtyOptions {
	terminal: Terminal | null;
	terminalId: string;
}

// Hook up the on-screen terminal to a real shell: show output, typing, resize, and tear down when the tab goes away.
export function usePty({ terminal, terminalId }: UsePtyOptions) {
	// Parent keeps one stable resize callback; inside we swap what it actually does once the shell exists.
	const { resizeTargetRef, sendResize } = useResizeForwarder();

	useEffect(() => {
		if (!terminal) return;
		const term = terminal;

		// Read store actions once; they do not change identity.
		const {
			setCwd,
			setPtyId,
			setClaudeCodeActive,
			setClaudeState,
			setClaudeSessionTitle,
			setClaudeModel,
			setShellState,
		} = useTerminalStore.getState();

		// Random id so each message can be tied to this tab.
		const ptyId = crypto.randomUUID();
		// One bag of listeners and flags for this mount so cleanup stays in one place.
		const ptyMount = createPtyEffectState(ptyId, terminalId);

		// Filled in below once the shell exists; until then this is a no-op.
		resizeTargetRef.current = (cols: number, rows: number) => {
			// Skip resize until the shell exists and while the tab is still open.
			if (!ptyMount.isEffectActive || !ptyMount.isShellReady) return;
			invoke("pty_resize", { id: ptyMount.ptyId, cols, rows }).catch((err) =>
				toastErrorThrottled(
					`pty-resize-${ptyMount.ptyId}`,
					"Could not resize terminal",
					err,
				),
			);
		};

		const run = async () => {
			const { cols, rows } = term;

			const home = await getHomeDir().catch(() => "");
			// After any wait, the user may have closed the tab—check before continuing.
			if (unmounted(ptyMount, "none")) return;

			// Listen for folder changes, Claude labels, and busy/idle from the shell output.
			const ptyOscRegistration = registerPtyOscHandlers(
				term,
				terminalId,
				home,
				{
					setCwd,
					setShellState,
					setClaudeState,
					setClaudeModel,
					setClaudeSessionTitle,
				},
			);
			ptyMount.resetClaudeUiFields = ptyOscRegistration.resetClaudeUiFields;
			ptyMount.disposeTerminalStreamHooks = ptyOscRegistration.disposables;

			// Pipe shell output into the on-screen terminal (text arrives encoded and is decoded here).
			ptyMount.unsubscribeShellOutput = await listen<string>(
				`pty://data/${ptyId}`,
				(event) => {
					if (unmounted(ptyMount, "none")) return;
					const chunk = decodePtyBase64PayloadChunk(
						ptyMount.shellOutputDecoder,
						event.payload,
					);
					term.write(chunk);
				},
			);

			ptyMount.unsubscribeProcessExit = await listen<null>(
				`pty://exit/${ptyId}`,
				() => {
					term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
				},
			);

			if (unmounted(ptyMount, "listeners")) return;

			const initialCwd =
				findTerminal(useTerminalStore.getState().workspaces, terminalId)
					?.cwd ?? null;
			await invoke("pty_create", {
				id: ptyId,
				cols,
				rows,
				cwd: initialCwd,
			});

			if (unmounted(ptyMount, "pty")) return;

			ptyMount.isShellReady = true;
			// Match the shell size to what the on-screen terminal already shows.
			resizeTargetRef.current(term.cols, term.rows);

			setPtyId(terminalId, ptyId);

			const pollClaude = makePollClaudeCodeActive({
				ptyMount,
				terminalId,
				setClaudeCodeActive,
			});
			await pollClaude();
			ptyMount.claudePollIntervalId = setInterval(pollClaude, 1000);

			// Remember how to stop forwarding keys when the tab closes.
			ptyMount.disposeTypingToShell = term.onData((data) => {
				if (unmounted(ptyMount, "none")) return;
				invoke("pty_write", { id: ptyId, data }).catch((err) =>
					toastErrorThrottled(
						`pty-write-${ptyId}`,
						"Could not send input to terminal",
						err,
					),
				);
			});

			term.focus();
		};

		run().catch((err) => {
			toastError("Could not start terminal", err);
			if (!unmounted(ptyMount, "none")) {
				term.writeln(`\r\n\x1b[31m[blackslate error] ${err}\x1b[0m`);
			}
		});

		return () => {
			teardownPtyEffect(ptyMount, {
				resetResizeHandler: () => {
					resizeTargetRef.current = () => {};
				},
				onStoreCleanup: () => {
					setClaudeCodeActive(terminalId, false);
					ptyMount.resetClaudeUiFields();
					setPtyId(terminalId, null);
				},
			});
		};
	}, [terminal, terminalId]);

	return { sendResize };
}

// After a wait, the tab might be gone. If so, clean up a bit and return true so setup stops.
// "none" means we have nothing extra to undo yet; full cleanup runs later.
function unmounted(
	ptyMount: PtyEffectState,
	cleanup: "none" | "listeners" | "pty",
): boolean {
	if (ptyMount.isEffectActive) return false;
	if (cleanup === "listeners") abortAfterListeners(ptyMount);
	else if (cleanup === "pty") abortAfterPtyCreate(ptyMount);
	return true;
}

// One outward resize function; the inner implementation is swapped when the shell appears.
function useResizeForwarder() {
	const resizeTargetRef = useRef<(cols: number, rows: number) => void>(
		() => {},
	);
	const sendResize = useCallback((cols: number, rows: number) => {
		resizeTargetRef.current(cols, rows);
	}, []);
	return { resizeTargetRef, sendResize };
}

// Every second, ask whether Claude is running in this shell; update the tab only when that changes.
function makePollClaudeCodeActive(options: {
	ptyMount: PtyEffectState;
	terminalId: string;
	setClaudeCodeActive: (terminalId: string, on: boolean) => void;
}): () => Promise<void> {
	const { ptyMount, terminalId, setClaudeCodeActive } = options;
	return async () => {
		if (unmounted(ptyMount, "none")) return;
		try {
			const claudeActive = await invoke<boolean>("pty_claude_code_active", {
				id: ptyMount.ptyId,
			});
			if (unmounted(ptyMount, "none")) return;
			if (claudeActive !== ptyMount.lastClaudeCodeActivePoll) {
				ptyMount.lastClaudeCodeActivePoll = claudeActive;
				setClaudeCodeActive(terminalId, claudeActive);
				// When Claude stops, clear the extra labels we learned from its output.
				if (!claudeActive) ptyMount.resetClaudeUiFields();
			}
		} catch {
			if (unmounted(ptyMount, "none")) return;
			if (ptyMount.lastClaudeCodeActivePoll !== false) {
				ptyMount.lastClaudeCodeActivePoll = false;
				setClaudeCodeActive(terminalId, false);
				ptyMount.resetClaudeUiFields();
			}
		}
	};
}
