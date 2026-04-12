import type { Terminal, Workspace } from "@/store/terminalsTypes";

// Short label for a folder path: last piece of the path, or "~" or "/".
export function shortCwdLabel(terminal: Terminal): string {
	if (terminal.cwd === "~" || terminal.cwd === "/") return terminal.cwd;
	return terminal.cwd.split("/").filter(Boolean).pop() ?? "~";
}

// What we show on the tab: custom name, else Claude’s title, else short folder name.
export function terminalDisplayName(terminal: Terminal): string {
	if (terminal.customName !== null) return terminal.customName;
	if (terminal.claudeSessionTitle) return terminal.claudeSessionTitle;
	return shortCwdLabel(terminal);
}

export function workspaceDisplayName(workspace: Workspace): string {
	if (workspace.customName !== null) return workspace.customName;
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	if (!activePane) return "~";
	const active =
		activePane.terminals.find((t) => t.id === activePane.activeTerminalId) ??
		activePane.terminals[0];
	if (!active) return "~";
	return terminalDisplayName(active);
}

// Turn "~" or "~/foo" into a real path using the user’s home folder.
export function cwdToAbsolute(cwd: string, home: string): string {
	const h = home.replace(/\/$/, "");
	if (cwd === "~" || cwd === "") return h;
	if (cwd.startsWith("~/")) return `${h}${cwd.slice(1)}`;
	return cwd;
}
