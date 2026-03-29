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

/**
 * A workspace is one sidebar entry that groups multiple terminal sessions
 * (horizontal tabs). ⌘N creates a new workspace; ⌘T creates a new session
 * within the active workspace.
 */
export interface Workspace {
	id: string;
	sessions: Session[];
	/** The session currently shown in this workspace's terminal area. */
	activeSessionId: string;
}

interface SessionState {
	workspaces: Workspace[];
	activeWorkspaceId: string;
}

interface SessionActions {
	// ── Workspace lifecycle ──────────────────────────────────────────────────
	/** Create a new workspace with one fresh session, make it active (⌘N). */
	createWorkspace: () => void;
	/** Close a workspace and all its sessions. Always keeps at least one workspace. */
	closeWorkspace: (workspaceId: string) => void;
	/** Switch the visible workspace (sidebar click). */
	activateWorkspace: (workspaceId: string) => void;

	// ── Session lifecycle (within a workspace) ───────────────────────────────
	/** Add a new session to an existing workspace, make it active (⌘T). */
	createSessionInWorkspace: (workspaceId: string) => void;
	/**
	 * Close a session within a workspace.
	 * If it was the last session, the workspace itself is closed.
	 */
	closeSession: (workspaceId: string, sessionId: string) => void;
	/** Switch the active tab within a workspace. */
	activateSession: (workspaceId: string, sessionId: string) => void;

	// ── Per-session state setters ────────────────────────────────────────────
	// These take only `sessionId` — the store finds the owning workspace
	// internally. This keeps `usePty` and `TerminalPane` free of workspaceId.

	/** Update the working directory (called by the OSC 7 parser in usePty). */
	setCwd: (sessionId: string, cwd: string) => void;
	/** Update git info (called after cwd changes). */
	setGit: (sessionId: string, git: GitInfo | null) => void;
	setProjectStack: (sessionId: string, stack: ProjectStackItem[]) => void;
	/** Link React session id ↔ PTY backend id after `pty_create`. */
	setPtyId: (sessionId: string, ptyId: string | null) => void;
	setClaudeCodeActive: (sessionId: string, active: boolean) => void;
	setClaudeState: (sessionId: string, state: ClaudeState) => void;
	setClaudeSessionTitle: (sessionId: string, title: string | null) => void;
	setClaudeModel: (sessionId: string, model: string | null) => void;
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

// ---------------------------------------------------------------------------
// Selectors (pure functions — safe to call outside React)
// ---------------------------------------------------------------------------

export function selectActiveWorkspace(
	state: Pick<SessionState, "workspaces" | "activeWorkspaceId">,
): Workspace | undefined {
	return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
}

export function selectActiveSession(
	state: Pick<SessionState, "workspaces" | "activeWorkspaceId">,
): Session | undefined {
	const ws = selectActiveWorkspace(state);
	return ws?.sessions.find((s) => s.id === ws.activeSessionId);
}

/**
 * Find a session by id across all workspaces.
 * Use this in component selectors instead of iterating sessions directly.
 */
export function findSession(
	workspaces: Workspace[],
	sessionId: string,
): Session | undefined {
	for (const ws of workspaces) {
		const s = ws.sessions.find((x) => x.id === sessionId);
		if (s) return s;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialWorkspace = makeWorkspace();

export const useSessionStore = create<SessionStore>((set) => ({
	workspaces: [initialWorkspace],
	activeWorkspaceId: initialWorkspace.id,

	// ── Workspace lifecycle ──────────────────────────────────────────────────

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

	// ── Session lifecycle ────────────────────────────────────────────────────

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

	// ── Per-session state setters ────────────────────────────────────────────

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

// ---------------------------------------------------------------------------
// Display helpers (pure, no hooks)
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
