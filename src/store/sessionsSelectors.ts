import type { Session, SessionState, Workspace } from "@/store/sessionsTypes";

/**
 * Pure selectors — safe to call outside React (tests, derived state).
 */

export function selectActiveWorkspace(
	state: Pick<SessionState, "workspaces" | "activeWorkspaceId">,
): Workspace | undefined {
	return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
}

export function selectActiveSession(
	state: Pick<SessionState, "workspaces" | "activeWorkspaceId">,
): Session | undefined {
	const ws = selectActiveWorkspace(state);
	return ws?.sessions.find((s) => s.id === ws.activeSessionId);
}

/**
 * Find a session by id across all workspaces.
 * Use this in component selectors instead of iterating sessions directly.
 */
export function findSession(
	workspaces: Workspace[],
	sessionId: string,
): Session | undefined {
	for (const ws of workspaces) {
		const s = ws.sessions.find((x) => x.id === sessionId);
		if (s) return s;
	}
	return undefined;
}
