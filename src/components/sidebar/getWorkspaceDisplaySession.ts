import type { Session, Workspace } from "@/store/sessions";

/**
 * Sidebar shows one row per workspace; the row reflects the active tab's session.
 * Resolves: active pane → active session. Falls back to first pane / first session
 * for edge cases (e.g. missing id after a layout migration).
 */
export function getWorkspaceDisplaySession(workspace: Workspace): Session {
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	return (
		activePane.sessions.find((s) => s.id === activePane.activeSessionId) ??
		activePane.sessions[0]
	);
}
