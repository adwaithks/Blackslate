import { create } from "zustand";

export type RenameUiTarget =
	| { kind: "session"; sessionId: string }
	| { kind: "workspace"; workspaceId: string };

type RenameUiState = {
	target: RenameUiTarget | null;
	openSession: (sessionId: string) => void;
	openWorkspace: (workspaceId: string) => void;
	close: () => void;
};

// When i want to rename a session or workspace, i can use this store to set the target
// which can be either a session or a workspace. And then i can use the target
// to open the rename dialog and now i know what i want to rename - workspace or session.
export const useRenameUiStore = create<RenameUiState>((set) => ({
	target: null,
	openSession: (sessionId) => set({ target: { kind: "session", sessionId } }),
	openWorkspace: (workspaceId) =>
		set({ target: { kind: "workspace", workspaceId } }),
	close: () => set({ target: null }),
}));
