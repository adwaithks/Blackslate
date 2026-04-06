/**
 * Zustand `persist` wiring for the session store: localStorage key, partialisation,
 * validation after rehydrate, and helpers to rebuild `Session` rows from disk.
 */

import { createJSONStorage } from "zustand/middleware";

import type {
	PersistedSession,
	PersistedSessionState,
	PersistedWorkspace,
	Session,
	SessionStore,
} from "@/store/sessionsTypes";

/** localStorage key — keep in sync with any docs / migrations. */
export const SESSION_LAYOUT_STORAGE_KEY = "blackslate-workspace-layout";

export const sessionLayoutLocalStorage = createJSONStorage<PersistedSessionState>(
	() => localStorage,
);

// ---------------------------------------------------------------------------
// Validation (unknown → PersistedSessionState)
// ---------------------------------------------------------------------------

function isPersistedSession(v: unknown): v is PersistedSession {
	if (!v || typeof v !== "object") return false;
	const s = v as Record<string, unknown>;
	return (
		typeof s.id === "string" &&
		(s.customName === null || typeof s.customName === "string") &&
		typeof s.cwd === "string" &&
		typeof s.createdAt === "number"
	);
}

function isPersistedWorkspace(v: unknown): v is PersistedWorkspace {
	if (!v || typeof v !== "object") return false;
	const w = v as Record<string, unknown>;
	return (
		typeof w.id === "string" &&
		(w.customName === null || typeof w.customName === "string") &&
		typeof w.activeSessionId === "string" &&
		Array.isArray(w.sessions) &&
		w.sessions.every(isPersistedSession)
	);
}

export function validatePersistedSessionState(
	v: unknown,
): v is PersistedSessionState {
	if (!v || typeof v !== "object") return false;
	const s = v as Record<string, unknown>;
	return (
		typeof s.activeWorkspaceId === "string" &&
		Array.isArray(s.workspaces) &&
		s.workspaces.length > 0 &&
		s.workspaces.every(isPersistedWorkspace) &&
		(s.workspaces as PersistedWorkspace[]).some(
			(w) => w.id === s.activeWorkspaceId,
		) &&
		(s.workspaces as PersistedWorkspace[]).every((w) =>
			w.sessions.some((sess) => sess.id === w.activeSessionId),
		)
	);
}

// ---------------------------------------------------------------------------
// Restore: persisted slice → full Session
// ---------------------------------------------------------------------------

export function sessionFromPersisted(
	p: PersistedSession,
	isMounted: boolean,
): Session {
	return {
		id: p.id,
		customName: p.customName,
		cwd: p.cwd,
		createdAt: p.createdAt,
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

/** Strip runtime fields before writing to localStorage. */
export function partializeSessionStore(s: SessionStore): PersistedSessionState {
	return {
		activeWorkspaceId: s.activeWorkspaceId,
		workspaces: s.workspaces.map((ws) => ({
			id: ws.id,
			customName: ws.customName,
			activeSessionId: ws.activeSessionId,
			sessions: ws.sessions.map(
				({ id, customName, cwd, createdAt }): PersistedSession => ({
					id,
					customName,
					cwd,
					createdAt,
				}),
			),
		})),
	};
}

export function clearPersistedSessionLayout(): void {
	localStorage.removeItem(SESSION_LAYOUT_STORAGE_KEY);
}

/**
 * After Zustand reads localStorage: validate shape, then call `restoreFromLayout`
 * so `isMounted` and runtime session fields are seeded correctly.
 */
export function handleSessionStoreRehydrate(
	state: SessionStore | undefined,
	error: unknown,
): void {
	if (error || !state) {
		clearPersistedSessionLayout();
		return;
	}
	const raw = partializeSessionStore(state);
	if (!validatePersistedSessionState(raw)) {
		clearPersistedSessionLayout();
		return;
	}
	state.restoreFromLayout(raw);
}
