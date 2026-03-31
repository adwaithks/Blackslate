import { confirm } from "@tauri-apps/plugin-dialog";
import type { Session, Workspace } from "@/store/sessions";

/** Shell has reported a running command (OSC preexec), not necessarily Claude. */
export function shellIsActive(session: Session): boolean {
	return session.shellState === "running";
}

/**
 * Busy terminal: shell command running or Claude Code active in the PTY.
 * Used for workspace-level rules (when to warn before closing a workspace).
 */
export function sessionHasActiveWork(session: Session): boolean {
	return session.shellState === "running" || session.claudeCodeActive;
}

export function workspaceHasActiveWork(workspace: Workspace): boolean {
	return workspace.sessions.some(sessionHasActiveWork);
}

/**
 * Close workspace (⌘⇧W, sidebar): confirm if any terminal is busy or there are 3+ tabs.
 */
export function workspaceNeedsCloseConfirmation(workspace: Workspace): boolean {
	return (
		workspaceHasActiveWork(workspace) || workspace.sessions.length >= 3
	);
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

/**
 * Close a single tab (not the last in the workspace): confirm only if the shell
 * reports an active command.
 */
export async function confirmCloseTerminalTab(session: Session): Promise<boolean> {
	if (!shellIsActive(session)) return true;
	return confirm(
		"A shell command is still running in this tab. Close it anyway?",
		{ title: "Close tab", kind: "warning" },
	);
}

/**
 * Tab bar / ⌘W: last tab in a workspace follows workspace close rules; otherwise shell-only.
 */
export async function confirmCloseSessionInWorkspace(
	workspace: Workspace,
	sessionId: string,
): Promise<boolean> {
	if (workspace.sessions.length <= 1) {
		return confirmCloseWorkspace(workspace);
	}
	const session = workspace.sessions.find((s) => s.id === sessionId);
	if (!session) return false;
	return confirmCloseTerminalTab(session);
}

/** Window close / Quit — always confirm. */
export async function confirmCloseWindow(): Promise<boolean> {
	return confirm(
		"Close this window? All terminal sessions will end.",
		{ title: "Blackslate", kind: "warning" },
	);
}
