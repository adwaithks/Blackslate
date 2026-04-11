/**
 * Workspace / session model for Blackslate.
 *
 * Layout: workspace → panes[] → sessions[]
 *   - A workspace is one sidebar entry.
 *   - A pane is a layout region inside a workspace (e.g. left / right split).
 *     For now every workspace starts with exactly one pane; the UI for creating
 *     additional panes (vertical splits) is not yet implemented.
 *   - A session is one terminal tab inside a pane.
 *
 * Layout is persisted to localStorage via Zustand persist (see `sessionsPersistence.ts`).
 * Only the fields in `PersistedSession` / `PersistedPane` / `PersistedWorkspace` are
 * written; runtime-only fields are stripped before each write and reset on restore.
 *
 * PTY wiring in `usePty`; OSC effects from `ptyStreamOsc.ts` (`@ansi-tools/parser`).
 * This store is the single source of truth for cwd, git, Claude UI state, etc.
 */

export interface GitInfo {
	branch: string;
	dirty: boolean;
}

/** Token usage for the most-recently completed Claude turn (from Stop hook + transcript). */
export interface TurnUsage {
	inputTokens: number;
	outputTokens: number;
	cacheRead: number;
	cacheWrite: number;
}

/**
 * Fine-grained Claude Code state, driven by lifecycle hooks (OSC 6974):
 *   'thinking'  — Claude is processing (UserPromptSubmit or PreToolUse hook)
 *   'waiting'   — Claude paused for permission or input (Notification hook)
 *   'complete'  — Claude finished its entire turn (Stop hook)
 *   null        — Claude not active, or state not yet determined
 */
export type ClaudeState = "thinking" | "waiting" | "complete" | null;

/**
 * Persisted fields — the subset written to localStorage on every mutation.
 * Runtime-only fields (`isMounted`, `ptyId`, `claudeCodeActive`, etc.) are
 * excluded and always reset to their zero values on restore.
 */
export interface PersistedSession {
	id: string;
	customName: string | null;
	cwd: string;
	createdAt: number;
}

export interface PersistedPane {
	id: string;
	activeSessionId: string;
	sessions: PersistedSession[];
}

export interface PersistedWorkspace {
	id: string;
	customName: string | null;
	activePaneId: string;
	panes: PersistedPane[];
}

export interface PersistedSessionState {
	activeWorkspaceId: string;
	workspaces: PersistedWorkspace[];
}

export interface Session {
	id: string;
	/**
	 * User-set tab label. When non-null, automatic labels (cwd / Claude session title) are ignored.
	 */
	customName: string | null;
	/** Current working directory, tilde-normalised (e.g. "~/Projects/Blackslate"). */
	cwd: string;
	/** Unix timestamp of when the session was created. */
	createdAt: number;
	/**
	 * Whether xterm + PTY have been initialised for this session.
	 * Starts `false` for sessions restored from localStorage; flipped to `true`
	 * when the session is first activated (or immediately for brand-new sessions).
	 * Once `true`, never goes back to `false` — visibility:hidden handles hiding.
	 */
	isMounted: boolean;
	/** Git info for the current cwd, null when not in a repo. */
	git: GitInfo | null;
	/** PTY backend id (Rust session key), set when the terminal connects. */
	ptyId: string | null;
	/** Whether Claude Code / `claude` CLI is running in that PTY (from OS process tree). */
	claudeCodeActive: boolean;
	/** Fine-grained Claude Code state parsed from the PTY stream. */
	claudeState: ClaudeState;
	/** AI-generated session name from Claude Code's OSC 0 window title (e.g. "New coding session"). */
	claudeSessionTitle: string | null;
	/** API model id: SessionStart OSC 6977, then Stop OSC 6976 `model=` when present. */
	claudeModel: string | null;
	/**
	 * Shell activity state from preexec/precmd hooks (OSC 6973):
	 *   'running' — a command is executing (preexec fired)
	 *   'idle'    — shell is at the prompt (precmd fired)
	 */
	shellState: "running" | "idle";
	/**
	 * Human-readable description of the tool Claude is currently running,
	 * e.g. "Reading App.tsx", "Running npm test". Null when no tool is active.
	 * Set by PreToolUse hook (OSC 6975); cleared on Stop/Notification/UserPromptSubmit.
	 */
	currentTool: string | null;
	/** Token usage from the most recently completed turn (OSC 6976 from Stop hook). */
	lastTurnUsage: TurnUsage | null;
	/** Sum of token usage across all completed turns in this terminal session (same source as lastTurnUsage). */
	cumulativeUsage: TurnUsage | null;
}

/**
 * A pane is a layout region inside a workspace that owns one or more terminal
 * sessions (horizontal tabs). Each workspace starts with a single pane.
 * Future work: multiple panes per workspace enables vertical splits.
 */
export interface Pane {
	id: string;
	sessions: Session[];
	/** The session currently shown in this pane's terminal area. */
	activeSessionId: string;
}

/**
 * A workspace is one sidebar entry that groups one or more panes.
 * ⌘N creates a new workspace; ⌘T creates a new session within the active pane
 * of the active workspace.
 */
export interface Workspace {
	id: string;
	/**
	 * User-set sidebar label. When non-null, the name no longer tracks the active terminal.
	 */
	customName: string | null;
	panes: Pane[];
	/** The pane currently visible in this workspace. */
	activePaneId: string;
}

export interface SessionState {
	workspaces: Workspace[];
	activeWorkspaceId: string;
}

export interface SessionActions {
	// ── Workspace lifecycle ──────────────────────────────────────────────────
	/** Create a new workspace with one fresh session, make it active (⌘N). */
	createWorkspace: () => void;
	/** Close a workspace and all its panes/sessions. Always keeps at least one workspace. */
	closeWorkspace: (workspaceId: string) => void;
	/** Switch the visible workspace (sidebar click). */
	activateWorkspace: (workspaceId: string) => void;

	// ── Session lifecycle (within the active pane of a workspace) ────────────
	/** Add a new session to the active pane of a workspace, make it active (⌘T). */
	createSessionInWorkspace: (workspaceId: string) => void;
	/**
	 * Close a session within a workspace (the store finds its pane internally).
	 * If it was the last session in the last pane, the workspace itself is closed.
	 */
	closeSession: (workspaceId: string, sessionId: string) => void;
	/** Switch the active tab within a workspace (store finds the pane internally). */
	activateSession: (workspaceId: string, sessionId: string) => void;

	// ── Per-session state setters ────────────────────────────────────────────
	// These take only `sessionId` — the store finds the owning workspace/pane
	// internally. This keeps `usePty` and `TerminalPane` free of workspaceId.

	/** Update the working directory (called by the OSC 7 parser in usePty). */
	setCwd: (sessionId: string, cwd: string) => void;
	/** Update git info (called after cwd changes). */
	setGit: (sessionId: string, git: GitInfo | null) => void;
	/** Link React session id ↔ PTY backend id after `pty_create`. */
	setPtyId: (sessionId: string, ptyId: string | null) => void;
	setClaudeCodeActive: (sessionId: string, active: boolean) => void;
	setClaudeState: (sessionId: string, state: ClaudeState) => void;
	setClaudeSessionTitle: (sessionId: string, title: string | null) => void;
	setClaudeModel: (sessionId: string, model: string | null) => void;
	/** Non-empty trimmed string locks the tab name; null clears to automatic naming. */
	setSessionCustomName: (sessionId: string, name: string | null) => void;
	setWorkspaceCustomName: (workspaceId: string, name: string | null) => void;
	setShellState: (sessionId: string, state: "running" | "idle") => void;
	setCurrentTool: (sessionId: string, tool: string | null) => void;
	setLastTurnUsage: (sessionId: string, usage: TurnUsage | null) => void;

	// ── Layout persistence ───────────────────────────────────────────────────
	/**
	 * Bulk-replace state from a validated persisted snapshot.
	 * Sets `isMounted: true` only for the active session in the active pane of the
	 * active workspace; all other restored sessions start unmounted and are lazily
	 * mounted on first activation.
	 */
	restoreFromLayout: (layout: PersistedSessionState) => void;
	/**
	 * Called when localStorage data is missing or fails validation.
	 * Clears the persisted key and resets to one fresh workspace + one pane + one session.
	 */
	resetToDefault: () => void;
}

export type SessionStore = SessionState & SessionActions;
