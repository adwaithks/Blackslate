import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { IDisposable } from "@xterm/xterm";
import { useTerminalStore } from "@/store/terminals";

// Everything we need to shut down one shell connection cleanly.
export type PtyEffectState = {
	// False once React has unmounted the tab; async work must stop.
	isEffectActive: boolean;
	// True only after the shell process was created; resize waits on this.
	isShellReady: boolean;
	// Id shared with the native side for this shell.
	readonly ptyId: string;
	unsubscribeShellOutput: UnlistenFn | null;
	unsubscribeProcessExit: UnlistenFn | null;
	// Stops forwarding typed keys to the shell.
	disposeTypingToShell: IDisposable | null;
	// Undo hooks that read shell output into app state.
	disposeTerminalStreamHooks: IDisposable[];
	// Turns incoming bytes into text across chunks.
	shellOutputDecoder: TextDecoder;
	claudePollIntervalId: ReturnType<typeof setInterval> | null;
	// Clear Claude-only fields on this tab in the store.
	resetClaudeUiFields: () => void;
	// Avoid writing the same on/off flag over and over.
	lastClaudeCodeActivePoll: boolean | undefined;
};

export function createPtyEffectState(
	ptyId: string,
	terminalId: string,
): PtyEffectState {
	// Default reset before the richer hooks are attached; teardown may still call this.
	const resetClaudeOscSessionSlice = () => {
		const { setClaudeState, setClaudeSessionTitle, setClaudeModel } =
			useTerminalStore.getState();
		setClaudeState(terminalId, null);
		setClaudeSessionTitle(terminalId, null);
		setClaudeModel(terminalId, null);
	};

	return {
		isEffectActive: true,
		isShellReady: false,
		ptyId,
		unsubscribeShellOutput: null,
		unsubscribeProcessExit: null,
		disposeTypingToShell: null,
		disposeTerminalStreamHooks: [],
		shellOutputDecoder: new TextDecoder(),
		claudePollIntervalId: null,
		resetClaudeUiFields: resetClaudeOscSessionSlice,
		lastClaudeCodeActivePoll: undefined,
	};
}

// Dispose all parser hooks that push into app state.
export function disposeTerminalStreamHooks(ptyMount: PtyEffectState): void {
	for (const disposable of ptyMount.disposeTerminalStreamHooks) disposable.dispose();
	ptyMount.disposeTerminalStreamHooks = [];
}

// Setup stopped after we subscribed to events but before the shell existed: drop listeners and hooks.
export function abortAfterListeners(ptyMount: PtyEffectState): void {
	ptyMount.unsubscribeShellOutput?.();
	ptyMount.unsubscribeProcessExit?.();
	ptyMount.unsubscribeShellOutput = null;
	ptyMount.unsubscribeProcessExit = null;
	disposeTerminalStreamHooks(ptyMount);
}

// Setup stopped after we asked for a shell: close it and remove hooks.
export function abortAfterPtyCreate(ptyMount: PtyEffectState): void {
	invoke("pty_close", { id: ptyMount.ptyId }).catch(() => {});
	disposeTerminalStreamHooks(ptyMount);
}

// Normal close: mark dead, flush text decoder, stop timers, unsubscribe, close shell, clear store fields.
export function teardownPtyEffect(
	ptyMount: PtyEffectState,
	opts: {
		resetResizeHandler: () => void;
		onStoreCleanup: () => void;
	},
): void {
	ptyMount.isEffectActive = false;
	ptyMount.shellOutputDecoder.decode(new Uint8Array(), { stream: false });
	disposeTerminalStreamHooks(ptyMount);
	if (ptyMount.claudePollIntervalId !== null) {
		clearInterval(ptyMount.claudePollIntervalId);
		ptyMount.claudePollIntervalId = null;
	}
	opts.onStoreCleanup();
	opts.resetResizeHandler();
	ptyMount.disposeTypingToShell?.dispose();
	ptyMount.disposeTypingToShell = null;
	ptyMount.unsubscribeShellOutput?.();
	ptyMount.unsubscribeProcessExit?.();
	ptyMount.unsubscribeShellOutput = null;
	ptyMount.unsubscribeProcessExit = null;
	invoke("pty_close", { id: ptyMount.ptyId }).catch(() => {});
}
