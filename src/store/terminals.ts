// Public entry for workspace and shell-tab state. Import from `@/store/terminals`.

export type {
	ClaudeState,
	GitInfo,
	Pane,
	PersistedPane,
	Terminal,
	TerminalsActions,
	TerminalsState,
	TerminalsStore,
	Workspace,
} from "@/store/terminalsTypes";

export {
	buildMountedTerminalRows,
	selectActiveTerminal,
	selectActivePaneForWorkspace,
	selectActiveWorkspace,
	selectActiveWorkspaceTabBarSignature,
	selectAppHeaderSlice,
	selectSidebarDisplaySignature,
	findTerminal,
	selectTerminalCwd,
	findPaneForTerminal,
	selectTerminalStackSignature,
} from "@/store/terminalsSelectors";

export {
	shortCwdLabel,
	cwdToAbsolute,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/terminalsDisplay";

export { useTerminalStore, patchTerminalById } from "@/store/terminalsStore";

export {
	TERMINAL_LAYOUT_PERSIST_VERSION,
	TERMINAL_LAYOUT_STORAGE_KEY,
	clearPersistedTerminalLayout,
} from "@/store/terminalsPersistence";
