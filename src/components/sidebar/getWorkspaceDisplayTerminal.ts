import type { Terminal, Workspace } from "@/store/terminals";

// Which terminal to show in the sidebar row for this workspace: the active tab, or the first if something is missing.
export function getWorkspaceDisplayTerminal(workspace: Workspace): Terminal {
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	return (
		activePane.terminals.find((t) => t.id === activePane.activeTerminalId) ??
		activePane.terminals[0]
	);
}
