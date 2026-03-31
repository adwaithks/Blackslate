import { create } from "zustand";

import { selectActiveSession } from "@/store/sessionsSelectors";
import type { Session, SessionStore, Workspace } from "@/store/sessionsTypes";

function makeSession(cwd = "~"): Session {
	return {
		id: crypto.randomUUID(),
		customName: null,
		cwd,
		createdAt: Date.now(),
		git: null,
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
	};
}

/** `initialCwd` is usually `~` (first launch) or copied from the session that was active when the user added a workspace/tab. */
function makeWorkspace(initialCwd = "~"): Workspace {
	const session = makeSession(initialCwd);
	return {
		id: crypto.randomUUID(),
		customName: null,
		sessions: [session],
		activeSessionId: session.id,
	};
}

/**
 * Patch a single field on a session found by sessionId across all workspaces.
 * Returns the workspaces array unchanged if the session isn't found.
 */
function patchSessionById<K extends keyof Session>(
	workspaces: Workspace[],
	sessionId: string,
	key: K,
	value: Session[K],
): Workspace[] {
	return workspaces.map((ws) => {
		const hasSession = ws.sessions.some((s) => s.id === sessionId);
		if (!hasSession) return ws;
		return {
			...ws,
			sessions: ws.sessions.map((s) =>
				s.id === sessionId ? { ...s, [key]: value } : s,
			),
		};
	});
}

function patchWorkspaceById<K extends keyof Workspace>(
	workspaces: Workspace[],
	workspaceId: string,
	key: K,
	value: Workspace[K],
): Workspace[] {
	return workspaces.map((w) =>
		w.id === workspaceId ? { ...w, [key]: value } : w,
	);
}

const initialWorkspace = makeWorkspace();

export const useSessionStore = create<SessionStore>((set) => ({
	workspaces: [initialWorkspace],
	activeWorkspaceId: initialWorkspace.id,

	createWorkspace() {
		set((s) => {
			const active = selectActiveSession(s);
			const cwd = active?.cwd ?? "~";
			const workspace = makeWorkspace(cwd);
			return {
				workspaces: [...s.workspaces, workspace],
				activeWorkspaceId: workspace.id,
			};
		});
	},

	closeWorkspace(workspaceId) {
		set((s) => {
			if (s.workspaces.length <= 1) return s;
			const idx = s.workspaces.findIndex((w) => w.id === workspaceId);
			const workspaces = s.workspaces.filter((w) => w.id !== workspaceId);
			const activeWorkspaceId =
				s.activeWorkspaceId === workspaceId
					? workspaces[Math.max(0, idx - 1)].id
					: s.activeWorkspaceId;
			return { workspaces, activeWorkspaceId };
		});
	},

	activateWorkspace(workspaceId) {
		set({ activeWorkspaceId: workspaceId });
	},

	createSessionInWorkspace(workspaceId) {
		set((s) => {
			const ws = s.workspaces.find((w) => w.id === workspaceId);
			const cwd =
				ws?.sessions.find((sess) => sess.id === ws.activeSessionId)
					?.cwd ?? "~";
			const session = makeSession(cwd);
			return {
				workspaces: s.workspaces.map((w) =>
					w.id === workspaceId
						? {
								...w,
								sessions: [...w.sessions, session],
								activeSessionId: session.id,
							}
						: w,
				),
			};
		});
	},

	closeSession(workspaceId, sessionId) {
		set((s) => {
			const ws = s.workspaces.find((w) => w.id === workspaceId);
			if (!ws) return s;

			// Last session in the workspace → close the whole workspace.
			if (ws.sessions.length <= 1) {
				if (s.workspaces.length <= 1) return s; // keep at least one workspace
				const idx = s.workspaces.findIndex((w) => w.id === workspaceId);
				const workspaces = s.workspaces.filter(
					(w) => w.id !== workspaceId,
				);
				const activeWorkspaceId =
					s.activeWorkspaceId === workspaceId
						? workspaces[Math.max(0, idx - 1)].id
						: s.activeWorkspaceId;
				return { workspaces, activeWorkspaceId };
			}

			// Remove the session; activate nearest sibling if it was active.
			const idx = ws.sessions.findIndex((x) => x.id === sessionId);
			const sessions = ws.sessions.filter((x) => x.id !== sessionId);
			const activeSessionId =
				ws.activeSessionId === sessionId
					? sessions[Math.max(0, idx - 1)].id
					: ws.activeSessionId;

			return {
				workspaces: s.workspaces.map((w) =>
					w.id === workspaceId
						? { ...w, sessions, activeSessionId }
						: w,
				),
			};
		});
	},

	activateSession(workspaceId, sessionId) {
		set((s) => ({
			workspaces: s.workspaces.map((w) =>
				w.id === workspaceId ? { ...w, activeSessionId: sessionId } : w,
			),
			activeWorkspaceId: workspaceId,
		}));
	},

	setCwd(sessionId, cwd) {
		set((s) => ({
			workspaces: patchSessionById(s.workspaces, sessionId, "cwd", cwd),
		}));
	},

	setGit(sessionId, git) {
		set((s) => ({
			workspaces: patchSessionById(s.workspaces, sessionId, "git", git),
		}));
	},

	setPtyId(sessionId, ptyId) {
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"ptyId",
				ptyId,
			),
		}));
	},

	setClaudeCodeActive(sessionId, claudeCodeActive) {
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"claudeCodeActive",
				claudeCodeActive,
			),
		}));
	},

	setClaudeState(sessionId, claudeState) {
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"claudeState",
				claudeState,
			),
		}));
	},

	setClaudeSessionTitle(sessionId, claudeSessionTitle) {
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"claudeSessionTitle",
				claudeSessionTitle,
			),
		}));
	},

	setClaudeModel(sessionId, claudeModel) {
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"claudeModel",
				claudeModel,
			),
		}));
	},

	setSessionCustomName(sessionId, name) {
		const v = name === null || name.trim() === "" ? null : name.trim();
		set((s) => ({
			workspaces: patchSessionById(
				s.workspaces,
				sessionId,
				"customName",
				v,
			),
		}));
	},

	setWorkspaceCustomName(workspaceId, name) {
		const v = name === null || name.trim() === "" ? null : name.trim();
		set((s) => ({
			workspaces: patchWorkspaceById(
				s.workspaces,
				workspaceId,
				"customName",
				v,
			),
		}));
	},
}));
