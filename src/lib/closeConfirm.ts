import { confirm } from "@tauri-apps/plugin-dialog";
import type { Terminal, Workspace } from "@/store/terminals";

// True when the shell says a command is still running (not only Claude).
export function shellIsActive(terminal: Terminal): boolean {
	return terminal.shellState === "running";
}

// True when something is busy: a running command or Claude turned on for this tab.
export function terminalHasActiveWork(terminal: Terminal): boolean {
	return terminal.shellState === "running" || terminal.claudeCodeActive;
}

export function workspaceHasActiveWork(workspace: Workspace): boolean {
	return workspace.panes.some((pane) =>
		pane.terminals.some(terminalHasActiveWork),
	);
}

// Ask before closing a whole workspace if something is busy or there are many tabs.
export function workspaceNeedsCloseConfirmation(workspace: Workspace): boolean {
	const totalTabs = workspace.panes.reduce(
		(sum, p) => sum + p.terminals.length,
		0,
	);
	return workspaceHasActiveWork(workspace) || totalTabs >= 3;
}

export async function confirmCloseWorkspace(
	workspace: Workspace,
): Promise<boolean> {
	if (!workspaceNeedsCloseConfirmation(workspace)) return true;
	return confirm(
		"Close this workspace and all of its terminal tabs?",
		{ title: "Close workspace", kind: "warning" },
	);
}

// Closing one tab: only ask if a shell command is still running.
export async function confirmCloseTerminalTab(terminal: Terminal): Promise<boolean> {
	if (!shellIsActive(terminal)) return true;
	return confirm(
		"A shell command is still running in this tab. Close it anyway?",
		{ title: "Close tab", kind: "warning" },
	);
}

// Closing the last tab in a workspace is treated like closing the workspace. Otherwise only the shell-running check above.
export async function confirmCloseTerminalInWorkspace(
	workspace: Workspace,
	terminalId: string,
): Promise<boolean> {
	const totalTabs = workspace.panes.reduce(
		(sum, p) => sum + p.terminals.length,
		0,
	);
	if (totalTabs <= 1) {
		return confirmCloseWorkspace(workspace);
	}
	let terminal: Terminal | undefined;
	for (const pane of workspace.panes) {
		terminal = pane.terminals.find((t) => t.id === terminalId);
		if (terminal) break;
	}
	if (!terminal) return false;
	return confirmCloseTerminalTab(terminal);
}

// Quitting the app: always ask.
export async function confirmCloseWindow(): Promise<boolean> {
	return confirm(
		"Close this window? All terminals will end.",
		{ title: "Blackslate", kind: "warning" },
	);
}
