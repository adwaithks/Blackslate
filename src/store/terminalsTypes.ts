// Describes workspaces, areas inside a workspace, and shell tabs.
// A workspace is one row in the left list. Each workspace has one or more areas (panes); each pane has one or more shell tabs.
// This file is the main place we remember folder path, git info, and what to show for Claude on each tab.
// Saved layout data lives in the browser; see terminalsPersistence.ts.
// The name claudeSessionTitle is Claude’s own session label from its window text, not “which tab” in our app.

export interface GitInfo {
	branch: string;
	dirty: boolean;
}

// Rough Claude status coming from the terminal text (for example busy or finished). Null means none.
export type ClaudeState = string | null;

// Only these fields are written when we save layout to the browser.
export interface PersistedTerminal {
	id: string;
	customName: string | null;
	cwd: string;
	createdAt: number;
}

export interface PersistedPane {
	id: string;
	activeTerminalId: string;
	terminals: PersistedTerminal[];
}

export interface PersistedWorkspace {
	id: string;
	customName: string | null;
	activePaneId: string;
	panes: PersistedPane[];
}

export interface PersistedTerminalsState {
	activeWorkspaceId: string;
	workspaces: PersistedWorkspace[];
}

// One shell tab: what you see in the tab strip and what the fake terminal is tied to.
export interface Terminal {
	id: string;
	customName: string | null;
	cwd: string;
	createdAt: number;
	isMounted: boolean;
	git: GitInfo | null;
	ptyId: string | null;
	claudeCodeActive: boolean;
	claudeState: ClaudeState;
	// Label Claude chose for its own session (from window title), not our tab id.
	claudeSessionTitle: string | null;
	claudeModel: string | null;
	shellState: "running" | "idle";
}

export interface Pane {
	id: string;
	terminals: Terminal[];
	activeTerminalId: string;
}

export interface Workspace {
	id: string;
	customName: string | null;
	panes: Pane[];
	activePaneId: string;
}

export interface TerminalsState {
	workspaces: Workspace[];
	activeWorkspaceId: string;
}

export interface TerminalsActions {
	createWorkspace: () => void;
	closeWorkspace: (workspaceId: string) => void;
	activateWorkspace: (workspaceId: string) => void;

	createTerminalInWorkspace: (workspaceId: string) => void;
	closeTerminal: (workspaceId: string, terminalId: string) => void;
	activateTerminal: (workspaceId: string, terminalId: string) => void;

	setCwd: (terminalId: string, cwd: string) => void;
	setGit: (terminalId: string, git: GitInfo | null) => void;
	setPtyId: (terminalId: string, ptyId: string | null) => void;
	setClaudeCodeActive: (terminalId: string, active: boolean) => void;
	setClaudeState: (terminalId: string, state: ClaudeState) => void;
	setClaudeSessionTitle: (terminalId: string, title: string | null) => void;
	setClaudeModel: (terminalId: string, model: string | null) => void;
	setTerminalCustomName: (terminalId: string, name: string | null) => void;
	setWorkspaceCustomName: (workspaceId: string, name: string | null) => void;
	setShellState: (terminalId: string, state: "running" | "idle") => void;

	restoreFromLayout: (layout: PersistedTerminalsState) => void;
	resetToDefault: () => void;
}

export type TerminalsStore = TerminalsState & TerminalsActions;
