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
	Workspace,
} from "@/store/sessionsTypes";

export {
	selectActiveSession,
	selectActiveWorkspace,
	findSession,
} from "@/store/sessionsSelectors";

export { sessionDisplayName, cwdToAbsolute } from "@/store/sessionsDisplay";

export { useSessionStore } from "@/store/sessionsStore";
