import type { Session, Workspace } from "@/store/sessions";

/**
 * Sidebar shows one row per workspace; the row reflects the active tab’s session.
 * If `activeSessionId` is missing from the list (edge case), fall back to the first tab.
 */
export function getWorkspaceDisplaySession(workspace: Workspace): Session {
	return (
		workspace.sessions.find((s) => s.id === workspace.activeSessionId) ??
		workspace.sessions[0]
	);
}
