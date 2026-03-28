import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitInfo {
	branch: string;
	dirty: boolean;
}

/** One stack line from `project_stack` (Rust) — add fields only with backend changes. */
export interface ProjectStackItem {
	id: string;
	label: string;
	version: string | null;
}

/**
 * Fine-grained Claude Code state, parsed from the PTY stream:
 *   'thinking' — Claude is processing (braille spinner in OSC 0 window title)
 *   'waiting'  — Claude finished responding (OSC 777 "waiting for your input")
 *   null       — Claude not active, or state not yet determined
 */
export type ClaudeState = "thinking" | "waiting" | null;

export interface Session {
	id: string;
	/** Current working directory, tilde-normalised (e.g. "~/Projects/Slate"). */
	cwd: string;
	/** Unix timestamp of when the session was created. */
	createdAt: number;
	/** Git info for the current cwd, null when not in a repo. */
	git: GitInfo | null;
	/** Detected project stacks (Rust, Go, Node, …) at cwd — empty when unknown/none. */
	projectStack: ProjectStackItem[];
	/** PTY backend id (Rust session key), set when the terminal connects. */
	ptyId: string | null;
	/** Whether Claude Code / `claude` CLI is running in that PTY (from OS process tree). */
	claudeCodeActive: boolean;
	/** Fine-grained Claude Code state parsed from the PTY stream. */
	claudeState: ClaudeState;
	/** AI-generated session name from Claude Code's OSC 0 window title (e.g. "New coding session"). */
	claudeSessionTitle: string | null;
	/** Claude model parsed from the splash screen (e.g. "Sonnet 4.6"). */
	claudeModel: string | null;
}

interface SessionState {
	sessions: Session[];
	activeId: string;
}

interface SessionActions {
	/** Open a new session and make it active. */
	createSession: () => void;
	/**
	 * Close a session. Activates the nearest sibling.
	 * Closing the last session is a no-op — one session must always exist.
	 */
	closeSession: (id: string) => void;
	/** Switch the visible terminal to the given session. */
	activateSession: (id: string) => void;
	/** Update the working directory for a session (called by the OSC 7 parser). */
	setCwd: (id: string, cwd: string) => void;
	/** Update the git info for a session (called after cwd changes). */
	setGit: (id: string, git: GitInfo | null) => void;
	setProjectStack: (id: string, stack: ProjectStackItem[]) => void;
	/** Link React session id ↔ PTY id after `pty_create`. */
	setPtyId: (id: string, ptyId: string | null) => void;
	setClaudeCodeActive: (id: string, active: boolean) => void;
	/** Update the fine-grained Claude state parsed from the PTY stream. */
	setClaudeState: (id: string, state: ClaudeState) => void;
	/** Update the AI-generated session title from Claude Code's window title. */
	setClaudeSessionTitle: (id: string, title: string | null) => void;
	/** Update the Claude model parsed from the splash screen. */
	setClaudeModel: (id: string, model: string | null) => void;
}

export type SessionStore = SessionState & SessionActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Apply a single-field patch to one session by id, leaving all others unchanged. */
function patchSession<K extends keyof Session>(
	sessions: Session[],
	id: string,
	key: K,
	value: Session[K],
): Session[] {
	return sessions.map((x) => (x.id === id ? { ...x, [key]: value } : x));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initial = makeSession();

export const useSessionStore = create<SessionStore>((set) => ({
	sessions: [initial],
	activeId: initial.id,

	createSession() {
		const session = makeSession();
		set((s) => ({
			sessions: [...s.sessions, session],
			activeId: session.id,
		}));
	},

	closeSession(id) {
		set((s) => {
			if (s.sessions.length <= 1) return s; // always keep one session alive

			const idx = s.sessions.findIndex((x) => x.id === id);
			const sessions = s.sessions.filter((x) => x.id !== id);

			// When closing the active session, activate the nearest sibling.
			const activeId =
				s.activeId === id
					? sessions[Math.max(0, idx - 1)].id
					: s.activeId;

			return { sessions, activeId };
		});
	},

	activateSession(id) {
		set({ activeId: id });
	},

	setCwd(id, cwd) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "cwd", cwd) }));
	},

	setGit(id, git) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "git", git) }));
	},

	setProjectStack(id, projectStack) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "projectStack", projectStack) }));
	},

	setPtyId(id, ptyId) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "ptyId", ptyId) }));
	},

	setClaudeCodeActive(id, active) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "claudeCodeActive", active) }));
	},

	setClaudeState(id, state) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "claudeState", state) }));
	},

	setClaudeSessionTitle(id, title) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "claudeSessionTitle", title) }));
	},

	setClaudeModel(id, model) {
		set((s) => ({ sessions: patchSession(s.sessions, id, "claudeModel", model) }));
	},
}));

// ---------------------------------------------------------------------------
// Derived helpers (pure, no hooks)
// ---------------------------------------------------------------------------

/** Return the display name for a session: the last path segment, or "~". */
export function sessionDisplayName(session: Session): string {
	if (session.cwd === "~" || session.cwd === "/") return session.cwd;
	return session.cwd.split("/").filter(Boolean).pop() ?? "~";
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
