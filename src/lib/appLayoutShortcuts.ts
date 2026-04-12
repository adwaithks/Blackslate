import type { Dispatch, SetStateAction } from "react";
import { useTerminalStore } from "@/store/terminals";
import { useRenameUiStore } from "@/store/renameUiStore";
import {
	confirmCloseTerminalInWorkspace,
	confirmCloseWorkspace,
} from "@/lib/closeConfirm";
import type { ShortcutDefinition } from "@/lib/appShortcuts";
import {
	cmdLetter,
	modBracketKey,
	modDigitKey,
	modLetter,
	modOptionDigitKey,
	modShiftLetter,
	zoomInKeys,
	zoomOutKey,
} from "@/lib/appShortcuts";

// Keyboard shortcuts for layout: workspaces, tabs, sidebar, git panel, zoom.
// Handlers read the latest store with getState() so lists stay current.

export interface AppLayoutShortcutDeps {
	// When the sidebar is hidden, number keys pick tabs instead of workspaces.
	sidebarOpen: boolean;
	setSidebarOpen: Dispatch<SetStateAction<boolean>>;
	setGitPanelOpen: Dispatch<SetStateAction<boolean>>;
	increaseFontSize: () => void;
	decreaseFontSize: () => void;
}

export function buildAppLayoutShortcuts(
	deps: AppLayoutShortcutDeps,
): ShortcutDefinition[] {
	const {
		sidebarOpen,
		setSidebarOpen,
		setGitPanelOpen,
		increaseFontSize,
		decreaseFontSize,
	} = deps;

	// ⌘1–9 — workspace N when sidebar is open; terminal tab N when sidebar is hidden
	const gotoWorkspaceShortcuts = Array.from({ length: 9 }, (_, i) => {
		const n = i + 1;
		return {
			id: `goto-workspace-${n}`,
			when: (e: KeyboardEvent) =>
				sidebarOpen && modDigitKey(e) === n,
			run: () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces[n - 1];
				if (ws) s.activateWorkspace(ws.id);
			},
		};
	});

	const gotoTabShortcutsWhenSidebarClosed = Array.from(
		{ length: 9 },
		(_, i) => {
			const n = i + 1;
			return {
				id: `goto-tab-cmd-${n}`,
				when: (e: KeyboardEvent) =>
					!sidebarOpen && modDigitKey(e) === n,
				run: () => {
					const s = useTerminalStore.getState();
					const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
					if (!ws) return;
					const pane = ws.panes.find((p) => p.id === ws.activePaneId);
					if (!pane) return;
					const target = pane.terminals[n - 1];
					if (target) s.activateTerminal(ws.id, target.id);
				},
			};
		},
	);

	// ⌘⌥1–9 — focus terminal tab N inside the active pane of the active workspace
	const gotoTabShortcuts = Array.from({ length: 9 }, (_, i) => {
		const n = i + 1;
		return {
			id: `goto-tab-${n}`,
			when: (e: KeyboardEvent) => modOptionDigitKey(e) === n,
			run: () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				const target = pane.terminals[n - 1];
				if (target) s.activateTerminal(ws.id, target.id);
			},
		};
	});

	return [
		...gotoWorkspaceShortcuts,
		...gotoTabShortcutsWhenSidebarClosed,
		...gotoTabShortcuts,
		{
			// ⌘N
			id: "new-workspace",
			when: (e: KeyboardEvent) => modLetter(e, "n"),
			run: () => useTerminalStore.getState().createWorkspace(),
		},
		{
			// ⌘T
			id: "new-tab",
			when: (e: KeyboardEvent) => modLetter(e, "t"),
			run: () => {
				const s = useTerminalStore.getState();
				s.createTerminalInWorkspace(s.activeWorkspaceId);
			},
		},
		{
			// ⌘W / ⌘Q — close active tab (⌘⇧Q is Quit in the app menu)
			id: "close-tab",
			when: (e: KeyboardEvent) => modLetter(e, "w") || modLetter(e, "q"),
			run: async () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				const activeTerminal = pane.terminals.find(
					(t) => t.id === pane.activeTerminalId,
				);
				if (!activeTerminal) return;
				const ok = await confirmCloseTerminalInWorkspace(
					ws,
					activeTerminal.id,
				);
				if (ok) s.closeTerminal(ws.id, activeTerminal.id);
			},
		},
		{
			// ⌘⇧R — rename the active workspace
			id: "rename-active-workspace",
			when: (e: KeyboardEvent) => modShiftLetter(e, "r"),
			run: () => {
				const id = useTerminalStore.getState().activeWorkspaceId;
				useRenameUiStore.getState().openWorkspace(id);
			},
		},
		{
			// ⌘R — rename the active tab (works while the terminal has focus)
			id: "rename-active-tab",
			when: (e: KeyboardEvent) => modLetter(e, "r"),
			run: () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				useRenameUiStore.getState().openTerminal(pane.activeTerminalId);
			},
		},
		{
			// ⌘⇧W — close active workspace (busy or 3+ tabs)
			id: "close-workspace",
			when: (e: KeyboardEvent) => modShiftLetter(e, "w"),
			run: async () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const ok = await confirmCloseWorkspace(ws);
				if (ok) s.closeWorkspace(ws.id);
			},
		},
		{
			// ⌘B — sidebar only (Ctrl+B is left for the shell)
			id: "toggle-sidebar",
			when: (e: KeyboardEvent) => cmdLetter(e, "b"),
			run: () => setSidebarOpen((o) => !o),
		},
		{
			// ⌘L
			id: "toggle-git-panel",
			when: (e: KeyboardEvent) => modLetter(e, "l"),
			run: () => setGitPanelOpen((o) => !o),
		},
		{
			// ⌘[
			id: "tab-prev",
			when: (e: KeyboardEvent) => modBracketKey(e, "left"),
			run: () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane || pane.terminals.length === 0) return;
				const i = pane.terminals.findIndex(
					(t) => t.id === pane.activeTerminalId,
				);
				if (i < 0) return;
				const prev = (i - 1 + pane.terminals.length) % pane.terminals.length;
				s.activateTerminal(ws.id, pane.terminals[prev].id);
			},
		},
		{
			// ⌘]
			id: "tab-next",
			when: (e: KeyboardEvent) => modBracketKey(e, "right"),
			run: () => {
				const s = useTerminalStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane || pane.terminals.length === 0) return;
				const i = pane.terminals.findIndex(
					(t) => t.id === pane.activeTerminalId,
				);
				if (i < 0) return;
				const next = (i + 1) % pane.terminals.length;
				s.activateTerminal(ws.id, pane.terminals[next].id);
			},
		},
		{
			id: "zoom-in",
			when: (e: KeyboardEvent) => zoomInKeys(e),
			run: () => increaseFontSize(),
		},
		{
			id: "zoom-out",
			when: (e: KeyboardEvent) => zoomOutKey(e),
			run: () => decreaseFontSize(),
		},
	];
}
