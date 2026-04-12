// Saves and loads workspace layout in the browser. Each saved blob has a version number.
// If the version does not match what this build expects, we throw the saved data away and start fresh.

import { createJSONStorage, type StorageValue } from "zustand/middleware";

import type {
	PersistedTerminal,
	PersistedTerminalsState,
	Terminal,
	TerminalsStore,
} from "@/store/terminalsTypes";

export const TERMINAL_LAYOUT_STORAGE_KEY = "blackslate-workspace-layout";

// Raise this when you change what we save. Older saved files will be ignored.
export const TERMINAL_LAYOUT_PERSIST_VERSION = 1;

export function terminalFromPersisted(
	p: PersistedTerminal,
	isMounted: boolean,
): Terminal {
	return {
		id: p.id,
		customName: p.customName,
		cwd: p.cwd,
		createdAt: p.createdAt,
		isMounted,
		git: null,
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
		shellState: "idle",
	};
}

// Builds the plain object we store (no live-only fields).
export function partializeTerminalStore(s: TerminalsStore): PersistedTerminalsState {
	return {
		activeWorkspaceId: s.activeWorkspaceId,
		workspaces: s.workspaces.map((ws) => ({
			id: ws.id,
			customName: ws.customName,
			activePaneId: ws.activePaneId,
			panes: ws.panes.map((pane) => ({
				id: pane.id,
				activeTerminalId: pane.activeTerminalId,
				terminals: pane.terminals.map(
					({ id, customName, cwd, createdAt }): PersistedTerminal => ({
						id,
						customName,
						cwd,
						createdAt,
					}),
				),
			})),
		})),
	};
}

export function clearPersistedTerminalLayout(): void {
	localStorage.removeItem(TERMINAL_LAYOUT_STORAGE_KEY);
}

const baseJsonStorage = createJSONStorage<PersistedTerminalsState>(
	() => localStorage,
);

function persistVersionMatches(parsed: { version?: unknown }): boolean {
	return (
		typeof parsed.version === "number" &&
		parsed.version === TERMINAL_LAYOUT_PERSIST_VERSION
	);
}

// When reading: only accept our current version; otherwise delete the key and let the app use defaults.
export const terminalLayoutLocalStorage = {
	...baseJsonStorage!,
	getItem: (name: string) => {
		const raw = localStorage.getItem(name);
		if (raw === null) return null;
		try {
			const parsed = JSON.parse(raw) as {
				state: unknown;
				version?: number;
			};
			if (!parsed || typeof parsed !== "object" || !("state" in parsed)) {
				localStorage.removeItem(name);
				return null;
			}
			if (!persistVersionMatches(parsed)) {
				localStorage.removeItem(name);
				return null;
			}
			return {
				...parsed,
				state: parsed.state as PersistedTerminalsState,
			} as StorageValue<PersistedTerminalsState>;
		} catch {
			localStorage.removeItem(name);
			return null;
		}
	},
};

// After load: rebuild tabs from saved data, or clear storage if that throws.
export function handleTerminalStoreRehydrate(
	state: TerminalsStore | undefined,
	error: unknown,
): void {
	if (error || !state) {
		clearPersistedTerminalLayout();
		return;
	}
	try {
		state.restoreFromLayout(partializeTerminalStore(state));
	} catch {
		clearPersistedTerminalLayout();
	}
}
