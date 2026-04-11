import type { Dispatch, SetStateAction } from "react";
import { useSessionStore } from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";
import {
	confirmCloseSessionInWorkspace,
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

// App-wide keyboard shortcuts (see useAppShortcuts in appShortcuts.ts).
// Handlers use useSessionStore.getState() so workspace list is always current.

export interface AppLayoutShortcutDeps {
	/** When false, ⌘1–9 switch terminal tabs instead of workspaces. */
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
				const s = useSessionStore.getState();
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
					const s = useSessionStore.getState();
					const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
					if (!ws) return;
					const pane = ws.panes.find((p) => p.id === ws.activePaneId);
					if (!pane) return;
					const target = pane.sessions[n - 1];
					if (target) s.activateSession(ws.id, target.id);
				},
			};
		},
	);

	// ⌘⌥1–9 — focus session tab N inside the active pane of the active workspace
	const gotoTabShortcuts = Array.from({ length: 9 }, (_, i) => {
		const n = i + 1;
		return {
			id: `goto-tab-${n}`,
			when: (e: KeyboardEvent) => modOptionDigitKey(e) === n,
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				const target = pane.sessions[n - 1];
				if (target) s.activateSession(ws.id, target.id);
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
			run: () => useSessionStore.getState().createWorkspace(),
		},
		{
			// ⌘T
			id: "new-tab",
			when: (e: KeyboardEvent) => modLetter(e, "t"),
			run: () => {
				const s = useSessionStore.getState();
				s.createSessionInWorkspace(s.activeWorkspaceId);
			},
		},
		{
			// ⌘W / ⌘Q — close active tab (⌘⇧Q is Quit in the app menu)
			id: "close-tab",
			when: (e: KeyboardEvent) => modLetter(e, "w") || modLetter(e, "q"),
			run: async () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				const session = pane.sessions.find(
					(sess) => sess.id === pane.activeSessionId,
				);
				if (!session) return;
				const ok = await confirmCloseSessionInWorkspace(ws, session.id);
				if (ok) s.closeSession(ws.id, session.id);
			},
		},
		{
			// ⌘⇧R — rename active workspace (same modifier rules as ⌘B; capture stops PTY)
			id: "rename-active-workspace",
			when: (e: KeyboardEvent) => modShiftLetter(e, "r"),
			run: () => {
				const id = useSessionStore.getState().activeWorkspaceId;
				useRenameUiStore.getState().openWorkspace(id);
			},
		},
		{
			// ⌘R — rename active tab (works with xterm focused; event intercepted in capture)
			id: "rename-active-tab",
			when: (e: KeyboardEvent) => modLetter(e, "r"),
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane) return;
				useRenameUiStore.getState().openSession(pane.activeSessionId);
			},
		},
		{
			// ⌘⇧W — close active workspace (busy or 3+ tabs)
			id: "close-workspace",
			when: (e: KeyboardEvent) => modShiftLetter(e, "w"),
			run: async () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const ok = await confirmCloseWorkspace(ws);
				if (ok) s.closeWorkspace(ws.id);
			},
		},
		{
			// ⌘B (not Ctrl+B — terminal / tmux)
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
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane || pane.sessions.length === 0) return;
				const i = pane.sessions.findIndex(
					(sess) => sess.id === pane.activeSessionId,
				);
				if (i < 0) return;
				const prev = (i - 1 + pane.sessions.length) % pane.sessions.length;
				s.activateSession(ws.id, pane.sessions[prev].id);
			},
		},
		{
			// ⌘]
			id: "tab-next",
			when: (e: KeyboardEvent) => modBracketKey(e, "right"),
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
				if (!ws) return;
				const pane = ws.panes.find((p) => p.id === ws.activePaneId);
				if (!pane || pane.sessions.length === 0) return;
				const i = pane.sessions.findIndex(
					(sess) => sess.id === pane.activeSessionId,
				);
				if (i < 0) return;
				const next = (i + 1) % pane.sessions.length;
				s.activateSession(ws.id, pane.sessions[next].id);
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
