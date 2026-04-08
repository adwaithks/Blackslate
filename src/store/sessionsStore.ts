import { create } from "zustand";
import { persist } from "zustand/middleware";

import { selectActiveSession } from "@/store/sessionsSelectors";
import {
	clearPersistedSessionLayout,
	handleSessionStoreRehydrate,
	partializeSessionStore,
	sessionFromPersisted,
	SESSION_LAYOUT_STORAGE_KEY,
	sessionLayoutLocalStorage,
} from "@/store/sessionsPersistence";
import type {
	GitInfo,
	PersistedSessionState,
	Session,
	SessionStore,
	TurnUsage,
	Workspace,
} from "@/store/sessionsTypes";

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeSession(cwd = "~", isMounted = false): Session {
	return {
		id: crypto.randomUUID(),
		customName: null,
		cwd,
		createdAt: Date.now(),
		isMounted,
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
	};
}

/** `initialCwd` is usually `~` (first launch) or copied from the active session when adding a workspace/tab. */
function makeWorkspace(initialCwd = "~", isMounted = false): Workspace {
	const session = makeSession(initialCwd, isMounted);
	return {
		id: crypto.randomUUID(),
		customName: null,
		sessions: [session],
		activeSessionId: session.id,
	};
}

// ---------------------------------------------------------------------------
// Patch helpers
// ---------------------------------------------------------------------------

function sessionFieldUnchanged<K extends keyof Session>(
	sess: Session,
	key: K,
	value: Session[K],
): boolean {
	if (Object.is(sess[key], value)) return true;
	if (key === "git" && sess.git && value) {
		const a = sess.git;
		const b = value as GitInfo;
		return a.branch === b.branch && a.dirty === b.dirty;
	}
	return false;
}

/**
 * Patch a single field on a session found by sessionId across all workspaces.
 * Returns the same `workspaces` reference when the session is not found —
 * avoids unnecessary re-renders from stale async handlers.
 */
export function patchSessionById<K extends keyof Session>(
	workspaces: Workspace[],
	sessionId: string,
	key: K,
	value: Session[K],
): Workspace[] {
	let updated = false;
	const result = workspaces.map((ws) => {
		const idx = ws.sessions.findIndex((s) => s.id === sessionId);
		if (idx === -1) return ws;
		const sess = ws.sessions[idx];
		if (sessionFieldUnchanged(sess, key, value)) {
			return ws;
		}
		updated = true;
		return {
			...ws,
			sessions: ws.sessions.map((s) =>
				s.id === sessionId ? { ...s, [key]: value } : s,
			),
		};
	});
	if (!updated) {
		return workspaces;
	}
	return result;
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

/** Flip isMounted=true on a specific session inside a specific workspace. */
function mountSession(
	workspaces: Workspace[],
	workspaceId: string,
	sessionId: string,
): Workspace[] {
	return workspaces.map((ws) => {
		if (ws.id !== workspaceId) return ws;
		return {
			...ws,
			sessions: ws.sessions.map((s) =>
				s.id === sessionId ? { ...s, isMounted: true } : s,
			),
		};
	});
}

// ---------------------------------------------------------------------------
// Default state (also used for resetToDefault)
// ---------------------------------------------------------------------------

function makeDefaultState() {
	const workspace = makeWorkspace("~", true); // isMounted=true for fresh launch
	return {
		workspaces: [workspace],
		activeWorkspaceId: workspace.id,
	};
}

const initialState = makeDefaultState();

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionStore = create<SessionStore>()(
	persist<SessionStore, [], [], PersistedSessionState>(
		(set) => ({
			...initialState,

			// ── Workspace lifecycle ──────────────────────────────────────────
			createWorkspace() {
				set((s) => {
					const active = selectActiveSession(s);
					const cwd = active?.cwd ?? "~";
					const workspace = makeWorkspace(cwd, true); // always mounted immediately
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
					const isActiveWorkspace = s.activeWorkspaceId === workspaceId;
					const activeWorkspaceId = isActiveWorkspace
						? workspaces[Math.max(0, idx - 1)].id
						: s.activeWorkspaceId;
					return { workspaces, activeWorkspaceId };
				});
			},

			activateWorkspace(workspaceId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					// Mount the workspace's active session on first activation.
					const workspaces = mountSession(
						s.workspaces,
						workspaceId,
						ws.activeSessionId,
					);
					return { workspaces, activeWorkspaceId: workspaceId };
				});
			},

			createSessionInWorkspace(workspaceId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					const cwd =
						ws?.sessions.find((sess) => sess.id === ws.activeSessionId)
							?.cwd ?? "~";
					const session = makeSession(cwd, true); // always mounted immediately
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
					if (!ws.sessions.some((x) => x.id === sessionId)) return s;

					// Last session in the workspace → close the whole workspace.
					if (ws.sessions.length <= 1) {
						if (s.workspaces.length <= 1) return s;
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
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws || !ws.sessions.some((x) => x.id === sessionId)) return s;
					// Mount the session on first activation.
					const workspaces = mountSession(s.workspaces, workspaceId, sessionId);
					return {
						workspaces: workspaces.map((w) =>
							w.id === workspaceId
								? { ...w, activeSessionId: sessionId }
								: w,
						),
						activeWorkspaceId: workspaceId,
					};
				});
			},

			// ── Per-session state setters ────────────────────────────────────
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

			setShellState(sessionId, shellState) {
				set((s) => ({
					workspaces: patchSessionById(
						s.workspaces,
						sessionId,
						"shellState",
						shellState,
					),
				}));
			},

			setCurrentTool(sessionId, currentTool) {
				set((s) => ({
					workspaces: patchSessionById(
						s.workspaces,
						sessionId,
						"currentTool",
						currentTool,
					),
				}));
			},

			setLastTurnUsage(sessionId, lastTurnUsage) {
				set((s) => {
					const exists = s.workspaces.some((ws) =>
						ws.sessions.some((sess) => sess.id === sessionId),
					);
					if (!exists) return s;

					return {
						workspaces: s.workspaces.map((ws) => ({
							...ws,
							sessions: ws.sessions.map((sess) => {
								if (sess.id !== sessionId) return sess;
								if (lastTurnUsage === null) {
									return { ...sess, lastTurnUsage: null };
								}
								const prev = sess.cumulativeUsage;
								const cumulative: TurnUsage = prev
									? {
											inputTokens:
												prev.inputTokens + lastTurnUsage.inputTokens,
											outputTokens:
												prev.outputTokens + lastTurnUsage.outputTokens,
											cacheRead:
												prev.cacheRead + lastTurnUsage.cacheRead,
											cacheWrite:
												prev.cacheWrite + lastTurnUsage.cacheWrite,
										}
									: { ...lastTurnUsage };
								return { ...sess, lastTurnUsage, cumulativeUsage: cumulative };
							}),
						})),
					};
				});
			},

			// ── Layout persistence ───────────────────────────────────────────
			restoreFromLayout(layout) {
				set(() => {
					const { activeWorkspaceId, workspaces: persistedWorkspaces } = layout;
					const workspaces = persistedWorkspaces.map((pw) => ({
						id: pw.id,
						customName: pw.customName,
						activeSessionId: pw.activeSessionId,
						sessions: pw.sessions.map((ps) =>
							sessionFromPersisted(
								ps,
								// Only the active session in the active workspace is mounted eagerly.
								pw.id === activeWorkspaceId && ps.id === pw.activeSessionId,
							),
						),
					}));
					return { activeWorkspaceId, workspaces };
				});
			},

			resetToDefault() {
				clearPersistedSessionLayout();
				set(() => makeDefaultState());
			},
		}),
		{
			name: SESSION_LAYOUT_STORAGE_KEY,
			storage: sessionLayoutLocalStorage,
			partialize: partializeSessionStore,
			onRehydrateStorage: () => (state, error) =>
				handleSessionStoreRehydrate(state as SessionStore | undefined, error),
		},
	),
);
