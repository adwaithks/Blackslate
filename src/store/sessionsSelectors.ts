import type { Session, SessionState, Workspace } from "@/store/sessionsTypes";

/**
 * Pure selectors — safe to call outside React (tests, derived state).
 */

function displaySessionForWorkspace(workspace: Workspace): Session | undefined {
	return (
		workspace.sessions.find((s) => s.id === workspace.activeSessionId) ??
		workspace.sessions[0]
	);
}

/** Titlebar: omit high-churn fields (e.g. shellState) — use with `useShallow`. */
export function selectAppHeaderSlice(state: SessionState): {
	sessionId: string | null;
	cwd: string;
	branch: string | null;
	cumulativeUsage: Session["cumulativeUsage"];
	lastTurnUsage: Session["lastTurnUsage"];
} {
	const sess = selectActiveSession(state);
	if (!sess) {
		return {
			sessionId: null,
			cwd: "~",
			branch: null,
			cumulativeUsage: null,
			lastTurnUsage: null,
		};
	}
	return {
		sessionId: sess.id,
		cwd: sess.cwd,
		branch: sess.git?.branch ?? null,
		cumulativeUsage: sess.cumulativeUsage,
		lastTurnUsage: sess.lastTurnUsage,
	};
}

/**
 * Tab strip signature: labels + Claude tab UI; excludes shellState so `ls` does not repaint tabs.
 */
export function selectActiveWorkspaceTabBarSignature(state: SessionState): string {
	const w = selectActiveWorkspace(state);
	if (!w) return "";
	const parts = [
		w.id,
		w.customName ?? "",
		w.activeSessionId,
		w.sessions.map((s) => s.id).join(","),
	];
	for (const s of w.sessions) {
		parts.push(
			s.id,
			s.customName ?? "",
			s.cwd,
			s.claudeSessionTitle ?? "",
			s.claudeCodeActive ? "1" : "0",
			s.claudeState ?? "",
		);
	}
	return parts.join("\u001f");
}

/** Sidebar rows signature; excludes shellState. */
export function selectSidebarDisplaySignature(state: SessionState): string {
	const parts: string[] = [
		state.activeWorkspaceId,
		state.workspaces.map((w) => w.id).join(","),
	];
	for (const w of state.workspaces) {
		const sess = displaySessionForWorkspace(w);
		if (!sess) continue;
		parts.push(
			w.id,
			w.customName ?? "",
			String(w.sessions.length),
			sess.id,
			sess.customName ?? "",
			sess.cwd,
			sess.claudeSessionTitle ?? "",
			sess.git
				? `${sess.git.branch}\u001e${sess.git.dirty ? "1" : "0"}`
				: "",
			sess.claudeCodeActive ? "1" : "0",
			sess.claudeModel ?? "",
		);
	}
	return parts.join("\u001f");
}

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

/**
 * Mounted sessions (xterm + PTY) and which one is visible — used so the terminal
 * stack does not re-render on unrelated session field updates (e.g. cwd on another tab).
 */
export function buildMountedTerminalRows(
	state: SessionState,
): Array<{ sessionId: string; isActive: boolean }> {
	const rows: Array<{ sessionId: string; isActive: boolean }> = [];
	for (const w of state.workspaces) {
		for (const sess of w.sessions) {
			if (!sess.isMounted) continue;
			rows.push({
				sessionId: sess.id,
				isActive:
					w.id === state.activeWorkspaceId &&
					sess.id === w.activeSessionId,
			});
		}
	}
	rows.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
	return rows;
}

/** Stable string for Zustand — changes only when stack membership or active tab changes. */
export function selectTerminalStackSignature(state: SessionState): string {
	return buildMountedTerminalRows(state)
		.map((r) => `${r.sessionId}\u001f${r.isActive ? "1" : "0"}`)
		.join("\u001e");
}
