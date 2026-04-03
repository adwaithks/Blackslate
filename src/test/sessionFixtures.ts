import type { Session, Workspace } from "@/store/sessionsTypes";

/** Minimal `Session` for store / selector unit tests — override fields as needed. */
export function makeSession(
	partial: Partial<Session> & Pick<Session, "id">,
): Session {
	return {
		customName: null,
		cwd: "~",
		createdAt: 0,
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

/** Minimal `Workspace` for store / selector unit tests — override fields as needed. */
export function makeWorkspace(
	partial: Partial<Workspace> &
		Pick<Workspace, "id" | "sessions" | "activeSessionId">,
): Workspace {
	return {
		customName: null,
		...partial,
	};
}
