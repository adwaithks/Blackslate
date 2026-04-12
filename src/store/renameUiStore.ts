import { create } from "zustand";

export type RenameUiTarget =
	| { kind: "terminal"; terminalId: string }
	| { kind: "workspace"; workspaceId: string };

type RenameUiState = {
	target: RenameUiTarget | null;
	openTerminal: (terminalId: string) => void;
	openWorkspace: (workspaceId: string) => void;
	close: () => void;
};

// Remembers whether the rename dialog should edit a tab or a workspace, and which id.
export const useRenameUiStore = create<RenameUiState>((set) => ({
	target: null,
	openTerminal: (terminalId) =>
		set({ target: { kind: "terminal", terminalId } }),
	openWorkspace: (workspaceId) =>
		set({ target: { kind: "workspace", workspaceId } }),
	close: () => set({ target: null }),
}));
