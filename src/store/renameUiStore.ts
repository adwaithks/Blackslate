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

export const useRenameUiStore = create<RenameUiState>((set) => ({
	target: null,
	openSession: (sessionId) => set({ target: { kind: "session", sessionId } }),
	openWorkspace: (workspaceId) =>
		set({ target: { kind: "workspace", workspaceId } }),
	close: () => set({ target: null }),
}));
