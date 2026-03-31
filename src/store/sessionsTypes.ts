/**
 * Workspace / session model for Blackslate.
 *
 * Not persisted — in-memory only. PTY wiring and OSC parsing live in `usePty`;
 * this store is the single source of truth for cwd, git, Claude UI state, etc.
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

export interface Session {
	id: string;
	/**
	 * User-set tab label. When non-null, automatic labels (cwd / Claude session title) are ignored.
	 */
	customName: string | null;
	/** Current working directory, tilde-normalised (e.g. "~/Projects/Slate"). */
	cwd: string;
	/** Unix timestamp of when the session was created. */
	createdAt: number;
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
	/** Claude model parsed from the splash screen (e.g. "Sonnet 4.6"). */
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
}

/**
 * A workspace is one sidebar entry that groups multiple terminal sessions
 * (horizontal tabs). ⌘N creates a new workspace; ⌘T creates a new session
 * within the active workspace.
 */
export interface Workspace {
	id: string;
	/**
	 * User-set sidebar label. When non-null, the name no longer tracks the active terminal.
	 */
	customName: string | null;
	sessions: Session[];
	/** The session currently shown in this workspace's terminal area. */
	activeSessionId: string;
}

export interface SessionState {
	workspaces: Workspace[];
	activeWorkspaceId: string;
}

export interface SessionActions {
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
}

export type SessionStore = SessionState & SessionActions;
