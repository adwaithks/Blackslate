import type { IDisposable } from "@xterm/xterm";
import type { Terminal } from "@xterm/xterm";
import type { ClaudeState } from "@/store/terminalsTypes";
import {
	claudeLifecycleFromOsc6974Payload,
	cwdFromOsc7Payload,
	isClaudeProductWindowTitle,
	shellStateFromOsc6973Payload,
	stripClaudeWindowTitlePrefix,
} from "@/lib/ptyStreamOsc";

export interface RegisterPtyOscHandlersActions {
	setCwd: (terminalId: string, cwd: string) => void;
	setShellState: (terminalId: string, state: "running" | "idle") => void;
	setClaudeState: (terminalId: string, state: ClaudeState) => void;
	setClaudeModel: (terminalId: string, model: string | null) => void;
	setClaudeSessionTitle: (terminalId: string, title: string | null) => void;
}

// Watch shell output and window title, and keep the matching tab row in the store up to date.
export function registerPtyOscHandlers(
	term: Terminal,
	terminalId: string,
	home: string,
	actions: RegisterPtyOscHandlersActions,
): { disposables: IDisposable[]; resetClaudeUiFields: () => void } {
	// Only treat a window title as a Claude session name after we have seen Claude signals.
	let claudeOscActive = false;
	let lastSessionTitle: string | null = null;

	const resetClaudeUiFields = () => {
		claudeOscActive = false;
		lastSessionTitle = null;
		actions.setClaudeState(terminalId, null);
		actions.setClaudeSessionTitle(terminalId, null);
		actions.setClaudeModel(terminalId, null);
	};

	const disposables: IDisposable[] = [
		term.parser.registerOscHandler(7, (payload) => {
			const cwd = cwdFromOsc7Payload(payload, home);
			if (cwd !== null) actions.setCwd(terminalId, cwd);
			return true;
		}),
		term.parser.registerOscHandler(6973, (payload) => {
			const shellKind = shellStateFromOsc6973Payload(payload);
			if (shellKind === "running")
				actions.setShellState(terminalId, "running");
			else if (shellKind === "idle") actions.setShellState(terminalId, "idle");
			return true;
		}),
		term.parser.registerOscHandler(6974, (payload) => {
			const lifecycle = claudeLifecycleFromOsc6974Payload(payload);
			if (lifecycle !== null) {
				claudeOscActive = true;
				actions.setClaudeState(terminalId, lifecycle);
			}
			return true;
		}),
		term.parser.registerOscHandler(6977, (payload) => {
			const modelLabel = payload.trim();
			if (modelLabel) actions.setClaudeModel(terminalId, modelLabel);
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
					actions.setClaudeSessionTitle(terminalId, name);
				}
			} else if (claudeOscActive) {
				resetClaudeUiFields();
			}
		}),
	];

	return { disposables, resetClaudeUiFields };
}
