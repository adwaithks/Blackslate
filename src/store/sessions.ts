/**
 * Session / workspace Zustand store and related types, selectors, and display helpers.
 *
 * Import from `@/store/sessions` — this file re-exports split modules so call sites stay stable.
 */

export type {
	ClaudeState,
	GitInfo,
	Session,
	SessionActions,
	SessionState,
	SessionStore,
	TurnUsage,
	Workspace,
} from "@/store/sessionsTypes";

export {
	selectActiveSession,
	selectActiveWorkspace,
	findSession,
} from "@/store/sessionsSelectors";

export {
	sessionDisplayName,
	cwdToAbsolute,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/sessionsDisplay";

export { useSessionStore } from "@/store/sessionsStore";

export {
	SESSION_LAYOUT_STORAGE_KEY,
	clearPersistedSessionLayout,
	validatePersistedSessionState,
} from "@/store/sessionsPersistence";
