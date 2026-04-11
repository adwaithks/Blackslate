import type { Session, Workspace } from "@/store/sessionsTypes";

/** NOTE: session is equivalent to a terminal inside a pane inside a workspace. */

/**
 * display name for a session: the last path segment of cwd, or "~" / "/"
 * displayed in the tab bar of each terminal
 */
export function sessionDisplayName(session: Session): string {
	if (session.cwd === "~" || session.cwd === "/") return session.cwd;
	return session.cwd.split("/").filter(Boolean).pop() ?? "~";
}

/**
 * Tab label: explicit name wins, then Claude session title, then cwd folder name.
 */
export function terminalDisplayName(session: Session): string {
	if (session.customName !== null) return session.customName;
	if (session.claudeSessionTitle) return session.claudeSessionTitle;
	return sessionDisplayName(session);
}

/**
 * Sidebar workspace row: explicit name wins, else the active tab's {@link terminalDisplayName}.
 */
export function workspaceDisplayName(workspace: Workspace): string {
	if (workspace.customName !== null) return workspace.customName;
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	if (!activePane) return "~";
	const active =
		activePane.sessions.find((s) => s.id === activePane.activeSessionId) ??
		activePane.sessions[0];
	if (!active) return "~";
	return terminalDisplayName(active);
}

/**
 * Expand tilde-normalised cwd (as stored from OSC 7) to an absolute path for display.
 * `home` must be the real home directory path (e.g. from `get_home_dir`).
 */
export function cwdToAbsolute(cwd: string, home: string): string {
	const h = home.replace(/\/$/, "");
	if (cwd === "~" || cwd === "") return h;
	if (cwd.startsWith("~/")) return `${h}${cwd.slice(1)}`;
	return cwd;
}
