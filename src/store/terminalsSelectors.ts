import type { Pane, Terminal, TerminalsState, Workspace } from "@/store/terminalsTypes";

function activeTerminalForWorkspace(workspace: Workspace): Terminal | undefined {
	const activePane =
		workspace.panes.find((p) => p.id === workspace.activePaneId) ??
		workspace.panes[0];
	if (!activePane) return undefined;
	return (
		activePane.terminals.find((t) => t.id === activePane.activeTerminalId) ??
		activePane.terminals[0]
	);
}

export function selectAppHeaderSlice(state: TerminalsState): {
	terminalId: string | null;
	cwd: string;
	branch: string | null;
	cwdIsLinkedWorktree: boolean;
} {
	const term = selectActiveTerminal(state);
	if (!term) {
		return {
			terminalId: null,
			cwd: "~",
			branch: null,
			cwdIsLinkedWorktree: false,
		};
	}
	return {
		terminalId: term.id,
		cwd: term.cwd,
		branch: term.git?.branch ?? null,
		cwdIsLinkedWorktree: term.git?.linkedWorktree === true,
	};
}

export function selectActiveWorkspaceTabBarSignature(state: TerminalsState): string {
	const w = selectActiveWorkspace(state);
	if (!w) return "";
	const activePane = selectActivePaneForWorkspace(w);
	if (!activePane) return "";
	const parts = [
		w.id,
		w.customName ?? "",
		w.activePaneId,
		activePane.activeTerminalId,
		activePane.terminals.map((t) => t.id).join(","),
	];
	for (const t of activePane.terminals) {
		parts.push(
			t.id,
			t.customName ?? "",
			t.cwd,
			t.claudeSessionTitle ?? "",
			t.claudeCodeActive ? "1" : "0",
			t.claudeState ?? "",
		);
	}
	return parts.join("\u001f");
}

export function selectSidebarDisplaySignature(state: TerminalsState): string {
	const parts: string[] = [
		state.activeWorkspaceId,
		state.workspaces.map((w) => w.id).join(","),
	];
	for (const w of state.workspaces) {
		const term = activeTerminalForWorkspace(w);
		if (!term) continue;
		const totalTerminals = w.panes.reduce(
			(sum, p) => sum + p.terminals.length,
			0,
		);
		parts.push(
			w.id,
			w.customName ?? "",
			String(totalTerminals),
			term.id,
			term.customName ?? "",
			term.cwd,
			term.claudeSessionTitle ?? "",
			term.git
				? `${term.git.branch}\u001e${term.git.dirty ? "1" : "0"}\u001e${term.git.linkedWorktree ? "1" : "0"}`
				: "",
			term.claudeCodeActive ? "1" : "0",
			term.claudeModel ?? "",
		);
	}
	return parts.join("\u001f");
}

export function selectActiveWorkspace(
	state: Pick<TerminalsState, "workspaces" | "activeWorkspaceId">,
): Workspace | undefined {
	return state.workspaces.find((w) => w.id === state.activeWorkspaceId);
}

export function selectActivePaneForWorkspace(
	workspace: Workspace,
): Pane | undefined {
	return workspace.panes.find((p) => p.id === workspace.activePaneId);
}

export function selectActiveTerminal(
	state: Pick<TerminalsState, "workspaces" | "activeWorkspaceId">,
): Terminal | undefined {
	const ws = selectActiveWorkspace(state);
	if (!ws) return undefined;
	const pane = selectActivePaneForWorkspace(ws);
	return pane?.terminals.find((t) => t.id === pane.activeTerminalId);
}

export function findTerminal(
	workspaces: Workspace[],
	terminalId: string,
): Terminal | undefined {
	for (const ws of workspaces) {
		for (const pane of ws.panes) {
			const t = pane.terminals.find((x) => x.id === terminalId);
			if (t) return t;
		}
	}
	return undefined;
}

export function selectTerminalCwd(
	state: TerminalsState,
	terminalId: string,
): string {
	return findTerminal(state.workspaces, terminalId)?.cwd ?? "~";
}

export function findPaneForTerminal(
	workspace: Workspace,
	terminalId: string,
): Pane | undefined {
	return workspace.panes.find((p) =>
		p.terminals.some((t) => t.id === terminalId),
	);
}

export function buildMountedTerminalRows(
	state: TerminalsState,
): Array<{ terminalId: string; isActive: boolean }> {
	const rows: Array<{ terminalId: string; isActive: boolean }> = [];
	for (const w of state.workspaces) {
		for (const pane of w.panes) {
			for (const term of pane.terminals) {
				if (!term.isMounted) continue;
				rows.push({
					terminalId: term.id,
					isActive:
						w.id === state.activeWorkspaceId &&
						pane.id === w.activePaneId &&
						term.id === pane.activeTerminalId,
				});
			}
		}
	}
	rows.sort((a, b) => a.terminalId.localeCompare(b.terminalId));
	return rows;
}

export function selectTerminalStackSignature(state: TerminalsState): string {
	return buildMountedTerminalRows(state)
		.map((r) => `${r.terminalId}\u001f${r.isActive ? "1" : "0"}`)
		.join("\u001e");
}
