import type { Pane, Session, Workspace } from "@/store/sessionsTypes";

/** Minimal `Session` for store / selector unit tests — override fields as needed. */
export function makeSession(
	partial: Partial<Session> & Pick<Session, "id">,
): Session {
	return {
		customName: null,
		cwd: "~",
		createdAt: 0,
		isMounted: true,
		git: null,
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
		shellState: "idle",
		currentTool: null,
		lastTurnUsage: null,
		cumulativeUsage: null,
		...partial,
	};
}

/**
 * Minimal `Workspace` for unit tests.
 *
 * Accepts the legacy shorthand `{ sessions, activeSessionId }` and wraps them
 * into a single pane automatically — this keeps all existing test call-sites
 * unchanged while the runtime model uses workspace → panes[] → sessions[].
 */
export function makeWorkspace(
	partial: Partial<Omit<Workspace, "panes" | "activePaneId">> &
		Pick<Workspace, "id"> & {
			sessions: Session[];
			activeSessionId: string;
		},
): Workspace {
	const pane: Pane = {
		id: "pane-" + partial.id,
		sessions: partial.sessions,
		activeSessionId: partial.activeSessionId,
	};
	return {
		customName: partial.customName ?? null,
		id: partial.id,
		panes: [pane],
		activePaneId: pane.id,
	};
}
