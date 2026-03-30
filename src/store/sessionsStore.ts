import { create } from "zustand";

import type {
	Session,
	SessionStore,
	Workspace,
} from "@/store/sessionsTypes";

function makeSession(): Session {
	return {
		id: crypto.randomUUID(),
		cwd: "~",
		createdAt: Date.now(),
		git: null,
		projectStack: [],
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
	};
}

function makeWorkspace(): Workspace {
	const session = makeSession();
	return {
		id: crypto.randomUUID(),
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

const initialWorkspace = makeWorkspace();

export const useSessionStore = create<SessionStore>((set) => ({
	workspaces: [initialWorkspace],
	activeWorkspaceId: initialWorkspace.id,

	createWorkspace() {
		const workspace = makeWorkspace();
		set((s) => ({
			workspaces: [...s.workspaces, workspace],
			activeWorkspaceId: workspace.id,
		}));
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
		const session = makeSession();
		set((s) => ({
			workspaces: s.workspaces.map((w) =>
				w.id === workspaceId
					? { ...w, sessions: [...w.sessions, session], activeSessionId: session.id }
					: w,
			),
		}));
	},

	closeSession(workspaceId, sessionId) {
		set((s) => {
			const ws = s.workspaces.find((w) => w.id === workspaceId);
			if (!ws) return s;

			// Last session in the workspace → close the whole workspace.
			if (ws.sessions.length <= 1) {
				if (s.workspaces.length <= 1) return s; // keep at least one workspace
				const idx = s.workspaces.findIndex((w) => w.id === workspaceId);
				const workspaces = s.workspaces.filter((w) => w.id !== workspaceId);
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
					w.id === workspaceId ? { ...w, sessions, activeSessionId } : w,
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
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "cwd", cwd) }));
	},

	setGit(sessionId, git) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "git", git) }));
	},

	setProjectStack(sessionId, projectStack) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "projectStack", projectStack) }));
	},

	setPtyId(sessionId, ptyId) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "ptyId", ptyId) }));
	},

	setClaudeCodeActive(sessionId, claudeCodeActive) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "claudeCodeActive", claudeCodeActive) }));
	},

	setClaudeState(sessionId, claudeState) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "claudeState", claudeState) }));
	},

	setClaudeSessionTitle(sessionId, claudeSessionTitle) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "claudeSessionTitle", claudeSessionTitle) }));
	},

	setClaudeModel(sessionId, claudeModel) {
		set((s) => ({ workspaces: patchSessionById(s.workspaces, sessionId, "claudeModel", claudeModel) }));
	},
}));
