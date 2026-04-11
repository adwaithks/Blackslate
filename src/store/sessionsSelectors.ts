import type { Pane, Session, SessionState, Workspace } from "@/store/sessionsTypes";

/**
 * Pure selectors — safe to call outside React (tests, derived state).
 */

function displaySessionForWorkspace(workspace: Workspace): Session | undefined {
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	if (!activePane) return undefined;
	return (
		activePane.sessions.find((s) => s.id === activePane.activeSessionId) ??
		activePane.sessions[0]
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
	const activePane = selectActivePaneForWorkspace(w);
	if (!activePane) return "";
	const parts = [
		w.id,
		w.customName ?? "",
		w.activePaneId,
		activePane.activeSessionId,
		activePane.sessions.map((s) => s.id).join(","),
	];
	for (const s of activePane.sessions) {
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
		const totalSessions = w.panes.reduce((sum, p) => sum + p.sessions.length, 0);
		parts.push(
			w.id,
			w.customName ?? "",
			String(totalSessions),
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

export function selectActivePaneForWorkspace(
	workspace: Workspace,
): Pane | undefined {
	return workspace.panes.find((p) => p.id === workspace.activePaneId);
}

export function selectActiveSession(
	state: Pick<SessionState, "workspaces" | "activeWorkspaceId">,
): Session | undefined {
	const ws = selectActiveWorkspace(state);
	if (!ws) return undefined;
	const pane = selectActivePaneForWorkspace(ws);
	return pane?.sessions.find((s) => s.id === pane.activeSessionId);
}

/**
 * Find a session by id across all workspaces and panes.
 * Use this in component selectors instead of iterating sessions directly.
 */
export function findSession(
	workspaces: Workspace[],
	sessionId: string,
): Session | undefined {
	for (const ws of workspaces) {
		for (const pane of ws.panes) {
			const s = pane.sessions.find((x) => x.id === sessionId);
			if (s) return s;
		}
	}
	return undefined;
}

/**
 * Find the pane that owns a given session within a workspace.
 */
export function findPaneForSession(
	workspace: Workspace,
	sessionId: string,
): Pane | undefined {
	return workspace.panes.find((p) => p.sessions.some((s) => s.id === sessionId));
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
		for (const pane of w.panes) {
			for (const sess of pane.sessions) {
				if (!sess.isMounted) continue;
				rows.push({
					sessionId: sess.id,
					isActive:
						w.id === state.activeWorkspaceId &&
						pane.id === w.activePaneId &&
						sess.id === pane.activeSessionId,
				});
			}
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
