import type { Dispatch, SetStateAction } from "react";
import { useSessionStore } from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";
import type { ShortcutDefinition } from "@/lib/appShortcuts";
import {
	isInsideTerminal,
	modBracketKey,
	modDigitKey,
	modLetter,
	modOptionDigitKey,
	zoomInKeys,
	zoomOutKey,
} from "@/lib/appShortcuts";

// App-wide keyboard shortcuts (see useAppShortcuts in appShortcuts.ts).
// Handlers use useSessionStore.getState() so workspace list is always current.

export interface AppLayoutShortcutDeps {
	setSidebarOpen: Dispatch<SetStateAction<boolean>>;
	setGitPanelOpen: Dispatch<SetStateAction<boolean>>;
	increaseFontSize: () => void;
	decreaseFontSize: () => void;
}

export function buildAppLayoutShortcuts(
	deps: AppLayoutShortcutDeps,
): ShortcutDefinition[] {
	const {
		setSidebarOpen,
		setGitPanelOpen,
		increaseFontSize,
		decreaseFontSize,
	} = deps;

	// ⌘1–9 — focus workspace N in sidebar order
	const gotoWorkspaceShortcuts = Array.from({ length: 9 }, (_, i) => {
		const n = i + 1;
		return {
			id: `goto-workspace-${n}`,
			when: (e: KeyboardEvent) => modDigitKey(e) === n,
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces[n - 1];
				if (ws) s.activateWorkspace(ws.id);
			},
		};
	});

	// ⌘⌥1–9 — focus session tab N inside the active workspace (horizontal tabs)
	const gotoTabShortcuts = Array.from({ length: 9 }, (_, i) => {
		const n = i + 1;
		return {
			id: `goto-tab-${n}`,
			when: (e: KeyboardEvent) => modOptionDigitKey(e) === n,
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find(
					(w) => w.id === s.activeWorkspaceId,
				);
				if (!ws) return;
				const target = ws.sessions[n - 1];
				if (target) s.activateSession(ws.id, target.id);
			},
		};
	});

	return [
		...gotoWorkspaceShortcuts,
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
			// ⌘W / ⌘Q
			id: "close-tab",
			when: (e: KeyboardEvent) =>
				modLetter(e, "w") || modLetter(e, "q"),
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find(
					(w) => w.id === s.activeWorkspaceId,
				);
				if (ws) s.closeSession(ws.id, ws.activeSessionId);
			},
		},
		{
			// ⌘R — rename active tab (not while typing in the terminal surface)
			id: "rename-active-tab",
			when: (e: KeyboardEvent) =>
				modLetter(e, "r") && !isInsideTerminal(e.target),
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find(
					(w) => w.id === s.activeWorkspaceId,
				);
				if (!ws) return;
				useRenameUiStore.getState().openSession(ws.activeSessionId);
			},
		},
		{
			// ⌘B
			id: "toggle-sidebar",
			when: (e: KeyboardEvent) => modLetter(e, "b"),
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
				const ws = s.workspaces.find(
					(w) => w.id === s.activeWorkspaceId,
				);
				if (!ws || ws.sessions.length === 0) return;
				const i = ws.sessions.findIndex(
					(sess) => sess.id === ws.activeSessionId,
				);
				if (i < 0) return;
				const prev = (i - 1 + ws.sessions.length) % ws.sessions.length;
				s.activateSession(ws.id, ws.sessions[prev].id);
			},
		},
		{
			// ⌘]
			id: "tab-next",
			when: (e: KeyboardEvent) => modBracketKey(e, "right"),
			run: () => {
				const s = useSessionStore.getState();
				const ws = s.workspaces.find(
					(w) => w.id === s.activeWorkspaceId,
				);
				if (!ws || ws.sessions.length === 0) return;
				const i = ws.sessions.findIndex(
					(sess) => sess.id === ws.activeSessionId,
				);
				if (i < 0) return;
				const next = (i + 1) % ws.sessions.length;
				s.activateSession(ws.id, ws.sessions[next].id);
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
