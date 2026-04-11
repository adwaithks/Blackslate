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
	Pane,
	PersistedSessionState,
	Session,
	SessionStore,
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
	};
}

function makePane(cwd = "~", isMounted = false): Pane {
	const session = makeSession(cwd, isMounted);
	return {
		id: crypto.randomUUID(),
		sessions: [session],
		activeSessionId: session.id,
	};
}

/** `initialCwd` is usually `~` (first launch) or copied from the active session when adding a workspace/tab. */
function makeWorkspace(initialCwd = "~", isMounted = false): Workspace {
	const pane = makePane(initialCwd, isMounted);
	return {
		id: crypto.randomUUID(),
		customName: null,
		panes: [pane],
		activePaneId: pane.id,
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
 * Patch a single field on a session found by sessionId across all workspaces and panes.
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
		let paneUpdated = false;
		const panes = ws.panes.map((pane) => {
			const idx = pane.sessions.findIndex((s) => s.id === sessionId);
			if (idx === -1) return pane;
			const sess = pane.sessions[idx];
			if (sessionFieldUnchanged(sess, key, value)) return pane;
			paneUpdated = true;
			return {
				...pane,
				sessions: pane.sessions.map((s) =>
					s.id === sessionId ? { ...s, [key]: value } : s,
				),
			};
		});
		if (!paneUpdated) return ws;
		updated = true;
		return { ...ws, panes };
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

/** Flip isMounted=true on a specific session inside a specific workspace (searches all panes). */
function mountSession(
	workspaces: Workspace[],
	workspaceId: string,
	sessionId: string,
): Workspace[] {
	return workspaces.map((ws) => {
		if (ws.id !== workspaceId) return ws;
		return {
			...ws,
			panes: ws.panes.map((pane) => ({
				...pane,
				sessions: pane.sessions.map((s) =>
					s.id === sessionId ? { ...s, isMounted: true } : s,
				),
			})),
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
					const activePane = ws.panes.find((p) => p.id === ws.activePaneId);
					if (!activePane) return s;
					// Mount the active pane's active session on first activation.
					const workspaces = mountSession(
						s.workspaces,
						workspaceId,
						activePane.activeSessionId,
					);
					return { workspaces, activeWorkspaceId: workspaceId };
				});
			},

			createSessionInWorkspace(workspaceId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					const activePane = ws.panes.find((p) => p.id === ws.activePaneId);
					const cwd =
						activePane?.sessions.find(
							(sess) => sess.id === activePane.activeSessionId,
						)?.cwd ?? "~";
					const session = makeSession(cwd, true); // always mounted immediately
					return {
						workspaces: s.workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										panes: w.panes.map((p) =>
											p.id !== w.activePaneId
												? p
												: {
														...p,
														sessions: [...p.sessions, session],
														activeSessionId: session.id,
													},
										),
									},
						),
					};
				});
			},

			closeSession(workspaceId, sessionId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;

					// Find the pane that owns this session.
					const pane = ws.panes.find((p) =>
						p.sessions.some((x) => x.id === sessionId),
					);
					if (!pane) return s;

					const totalSessions = ws.panes.reduce(
						(sum, p) => sum + p.sessions.length,
						0,
					);

					// Last session across all panes → close the whole workspace.
					if (totalSessions <= 1) {
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

					// Last session in this pane (but other panes exist) → close the pane.
					if (pane.sessions.length <= 1) {
						const paneIdx = ws.panes.findIndex((p) => p.id === pane.id);
						const newPanes = ws.panes.filter((p) => p.id !== pane.id);
						const activePaneId =
							ws.activePaneId === pane.id
								? newPanes[Math.max(0, paneIdx - 1)].id
								: ws.activePaneId;
						return {
							workspaces: s.workspaces.map((w) =>
								w.id === workspaceId
									? { ...w, panes: newPanes, activePaneId }
									: w,
							),
						};
					}

					// Remove the session from its pane; activate nearest sibling if it was active.
					const idx = pane.sessions.findIndex((x) => x.id === sessionId);
					const sessions = pane.sessions.filter((x) => x.id !== sessionId);
					const activeSessionId =
						pane.activeSessionId === sessionId
							? sessions[Math.max(0, idx - 1)].id
							: pane.activeSessionId;

					return {
						workspaces: s.workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										panes: w.panes.map((p) =>
											p.id !== pane.id
												? p
												: { ...p, sessions, activeSessionId },
										),
									},
						),
					};
				});
			},

			activateSession(workspaceId, sessionId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					const pane = ws.panes.find((p) =>
						p.sessions.some((x) => x.id === sessionId),
					);
					if (!pane) return s;
					// Mount the session on first activation.
					const workspaces = mountSession(s.workspaces, workspaceId, sessionId);
					return {
						workspaces: workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										activePaneId: pane.id,
										panes: w.panes.map((p) =>
											p.id !== pane.id
												? p
												: { ...p, activeSessionId: sessionId },
										),
									},
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

			// ── Layout persistence ───────────────────────────────────────────
			restoreFromLayout(layout) {
				set(() => {
					const { activeWorkspaceId, workspaces: persistedWorkspaces } = layout;
					const workspaces = persistedWorkspaces.map((pw) => ({
						id: pw.id,
						customName: pw.customName,
						activePaneId: pw.activePaneId,
						panes: pw.panes.map((pp) => ({
							id: pp.id,
							activeSessionId: pp.activeSessionId,
							sessions: pp.sessions.map((ps) =>
								sessionFromPersisted(
									ps,
									// Only the active session in the active pane of the active workspace is mounted eagerly.
									pw.id === activeWorkspaceId &&
										pp.id === pw.activePaneId &&
										ps.id === pp.activeSessionId,
								),
							),
						})),
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
