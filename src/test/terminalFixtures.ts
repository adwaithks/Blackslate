import type { Pane, Terminal, Workspace } from "@/store/terminalsTypes";

// Build a fake terminal row for tests; pass only the fields you care about.
export function makeTerminal(
	partial: Partial<Terminal> & Pick<Terminal, "id">,
): Terminal {
	return {
		customName: null,
		cwd: "~",
		createdAt: 0,
		isMounted: true,
		git: null,
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
		shellState: "idle",
		...partial,
	};
}

// Build a fake workspace with one pane from a tab list + which tab is active.
export function makeWorkspace(
	partial: Partial<Omit<Workspace, "panes" | "activePaneId">> &
		Pick<Workspace, "id"> & {
			terminals: Terminal[];
			activeTerminalId: string;
		},
): Workspace {
	const pane: Pane = {
		id: "pane-" + partial.id,
		terminals: partial.terminals,
		activeTerminalId: partial.activeTerminalId,
	};
	return {
		customName: partial.customName ?? null,
		id: partial.id,
		panes: [pane],
		activePaneId: pane.id,
	};
}
