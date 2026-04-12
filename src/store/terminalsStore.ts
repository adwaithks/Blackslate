import { create } from "zustand";
import { persist } from "zustand/middleware";

import { selectActiveTerminal } from "@/store/terminalsSelectors";
import {
	clearPersistedTerminalLayout,
	handleTerminalStoreRehydrate,
	partializeTerminalStore,
	TERMINAL_LAYOUT_PERSIST_VERSION,
	TERMINAL_LAYOUT_STORAGE_KEY,
	terminalFromPersisted,
	terminalLayoutLocalStorage,
} from "@/store/terminalsPersistence";
import type {
	GitInfo,
	Pane,
	PersistedTerminalsState,
	Terminal,
	TerminalsStore,
	Workspace,
} from "@/store/terminalsTypes";

function makeTerminal(cwd = "~", isMounted = false): Terminal {
	return {
		id: crypto.randomUUID(),
		customName: null,
		cwd,
		createdAt: Date.now(),
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

function makePane(cwd = "~", isMounted = false): Pane {
	const terminal = makeTerminal(cwd, isMounted);
	return {
		id: crypto.randomUUID(),
		terminals: [terminal],
		activeTerminalId: terminal.id,
	};
}

function makeWorkspace(initialCwd = "~", isMounted = false): Workspace {
	const pane = makePane(initialCwd, isMounted);
	return {
		id: crypto.randomUUID(),
		customName: null,
		panes: [pane],
		activePaneId: pane.id,
	};
}

function terminalFieldUnchanged<K extends keyof Terminal>(
	term: Terminal,
	key: K,
	value: Terminal[K],
): boolean {
	if (Object.is(term[key], value)) return true;
	if (key === "git" && term.git && value) {
		const a = term.git;
		const b = value as GitInfo;
		return a.branch === b.branch && a.dirty === b.dirty;
	}
	return false;
}

export function patchTerminalById<K extends keyof Terminal>(
	workspaces: Workspace[],
	terminalId: string,
	key: K,
	value: Terminal[K],
): Workspace[] {
	let updated = false;
	const result = workspaces.map((ws) => {
		let paneUpdated = false;
		const panes = ws.panes.map((pane) => {
			const idx = pane.terminals.findIndex((t) => t.id === terminalId);
			if (idx === -1) return pane;
			const term = pane.terminals[idx];
			if (terminalFieldUnchanged(term, key, value)) return pane;
			paneUpdated = true;
			return {
				...pane,
				terminals: pane.terminals.map((t) =>
					t.id === terminalId ? { ...t, [key]: value } : t,
				),
			};
		});
		if (!paneUpdated) return ws;
		updated = true;
		return { ...ws, panes };
	});
	if (!updated) {
		return workspaces;
	}
	return result;
}

function patchWorkspaceById<K extends keyof Workspace>(
	workspaces: Workspace[],
	workspaceId: string,
	key: K,
	value: Workspace[K],
): Workspace[] {
	return workspaces.map((w) =>
		w.id === workspaceId ? { ...w, [key]: value } : w,
	);
}

function mountTerminal(
	workspaces: Workspace[],
	workspaceId: string,
	terminalId: string,
): Workspace[] {
	return workspaces.map((ws) => {
		if (ws.id !== workspaceId) return ws;
		return {
			...ws,
			panes: ws.panes.map((pane) => ({
				...pane,
				terminals: pane.terminals.map((t) =>
					t.id === terminalId ? { ...t, isMounted: true } : t,
				),
			})),
		};
	});
}

function makeDefaultState() {
	const workspace = makeWorkspace("~", true);
	return {
		workspaces: [workspace],
		activeWorkspaceId: workspace.id,
	};
}

const initialState = makeDefaultState();

export const useTerminalStore = create<TerminalsStore>()(
	persist<TerminalsStore, [], [], PersistedTerminalsState>(
		(set) => ({
			...initialState,

			createWorkspace() {
				set((s) => {
					const active = selectActiveTerminal(s);
					const cwd = active?.cwd ?? "~";
					const workspace = makeWorkspace(cwd, true);
					return {
						workspaces: [...s.workspaces, workspace],
						activeWorkspaceId: workspace.id,
					};
				});
			},

			closeWorkspace(workspaceId) {
				set((s) => {
					if (s.workspaces.length <= 1) return s;
					const idx = s.workspaces.findIndex((w) => w.id === workspaceId);
					const workspaces = s.workspaces.filter((w) => w.id !== workspaceId);
					const isActiveWorkspace = s.activeWorkspaceId === workspaceId;
					const activeWorkspaceId = isActiveWorkspace
						? workspaces[Math.max(0, idx - 1)].id
						: s.activeWorkspaceId;
					return { workspaces, activeWorkspaceId };
				});
			},

			activateWorkspace(workspaceId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					const activePane = ws.panes.find((p) => p.id === ws.activePaneId);
					if (!activePane) return s;
					const workspaces = mountTerminal(
						s.workspaces,
						workspaceId,
						activePane.activeTerminalId,
					);
					return { workspaces, activeWorkspaceId: workspaceId };
				});
			},

			createTerminalInWorkspace(workspaceId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					const activePane = ws.panes.find((p) => p.id === ws.activePaneId);
					const cwd =
						activePane?.terminals.find(
							(t) => t.id === activePane.activeTerminalId,
						)?.cwd ?? "~";
					const terminal = makeTerminal(cwd, true);
					return {
						workspaces: s.workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										panes: w.panes.map((p) =>
											p.id !== w.activePaneId
												? p
												: {
														...p,
														terminals: [...p.terminals, terminal],
														activeTerminalId: terminal.id,
													},
										),
									},
						),
					};
				});
			},

			closeTerminal(workspaceId, terminalId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;

					const pane = ws.panes.find((p) =>
						p.terminals.some((x) => x.id === terminalId),
					);
					if (!pane) return s;

					const totalTerminals = ws.panes.reduce(
						(sum, p) => sum + p.terminals.length,
						0,
					);

					if (totalTerminals <= 1) {
						if (s.workspaces.length <= 1) return s;
						const idx = s.workspaces.findIndex((w) => w.id === workspaceId);
						const workspaces = s.workspaces.filter(
							(w) => w.id !== workspaceId,
						);
						const activeWorkspaceId =
							s.activeWorkspaceId === workspaceId
								? workspaces[Math.max(0, idx - 1)].id
								: s.activeWorkspaceId;
						return { workspaces, activeWorkspaceId };
					}

					if (pane.terminals.length <= 1) {
						const paneIdx = ws.panes.findIndex((p) => p.id === pane.id);
						const newPanes = ws.panes.filter((p) => p.id !== pane.id);
						const activePaneId =
							ws.activePaneId === pane.id
								? newPanes[Math.max(0, paneIdx - 1)].id
								: ws.activePaneId;
						return {
							workspaces: s.workspaces.map((w) =>
								w.id === workspaceId
									? { ...w, panes: newPanes, activePaneId }
									: w,
							),
						};
					}

					const idx = pane.terminals.findIndex((x) => x.id === terminalId);
					const terminals = pane.terminals.filter((x) => x.id !== terminalId);
					const activeTerminalId =
						pane.activeTerminalId === terminalId
							? terminals[Math.max(0, idx - 1)].id
							: pane.activeTerminalId;

					return {
						workspaces: s.workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										panes: w.panes.map((p) =>
											p.id !== pane.id
												? p
												: { ...p, terminals, activeTerminalId },
										),
									},
						),
					};
				});
			},

			activateTerminal(workspaceId, terminalId) {
				set((s) => {
					const ws = s.workspaces.find((w) => w.id === workspaceId);
					if (!ws) return s;
					const pane = ws.panes.find((p) =>
						p.terminals.some((x) => x.id === terminalId),
					);
					if (!pane) return s;
					const workspaces = mountTerminal(s.workspaces, workspaceId, terminalId);
					return {
						workspaces: workspaces.map((w) =>
							w.id !== workspaceId
								? w
								: {
										...w,
										activePaneId: pane.id,
										panes: w.panes.map((p) =>
											p.id !== pane.id
												? p
												: { ...p, activeTerminalId: terminalId },
										),
									},
						),
						activeWorkspaceId: workspaceId,
					};
				});
			},

			setCwd(terminalId, cwd) {
				set((s) => ({
					workspaces: patchTerminalById(s.workspaces, terminalId, "cwd", cwd),
				}));
			},

			setGit(terminalId, git) {
				set((s) => ({
					workspaces: patchTerminalById(s.workspaces, terminalId, "git", git),
				}));
			},

			setPtyId(terminalId, ptyId) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"ptyId",
						ptyId,
					),
				}));
			},

			setClaudeCodeActive(terminalId, claudeCodeActive) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"claudeCodeActive",
						claudeCodeActive,
					),
				}));
			},

			setClaudeState(terminalId, claudeState) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"claudeState",
						claudeState,
					),
				}));
			},

			setClaudeSessionTitle(terminalId, claudeSessionTitle) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"claudeSessionTitle",
						claudeSessionTitle,
					),
				}));
			},

			setClaudeModel(terminalId, claudeModel) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"claudeModel",
						claudeModel,
					),
				}));
			},

			setTerminalCustomName(terminalId, name) {
				const v = name === null || name.trim() === "" ? null : name.trim();
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"customName",
						v,
					),
				}));
			},

			setWorkspaceCustomName(workspaceId, name) {
				const v = name === null || name.trim() === "" ? null : name.trim();
				set((s) => ({
					workspaces: patchWorkspaceById(
						s.workspaces,
						workspaceId,
						"customName",
						v,
					),
				}));
			},

			setShellState(terminalId, shellState) {
				set((s) => ({
					workspaces: patchTerminalById(
						s.workspaces,
						terminalId,
						"shellState",
						shellState,
					),
				}));
			},

			restoreFromLayout(layout) {
				set(() => {
					const { activeWorkspaceId, workspaces: persistedWorkspaces } = layout;
					const workspaces = persistedWorkspaces.map((pw) => ({
						id: pw.id,
						customName: pw.customName,
						activePaneId: pw.activePaneId,
						panes: pw.panes.map((pp) => ({
							id: pp.id,
							activeTerminalId: pp.activeTerminalId,
							terminals: pp.terminals.map((pt) =>
								terminalFromPersisted(
									pt,
									pw.id === activeWorkspaceId &&
										pp.id === pw.activePaneId &&
										pt.id === pp.activeTerminalId,
								),
							),
						})),
					}));
					return { activeWorkspaceId, workspaces };
				});
			},

			resetToDefault() {
				clearPersistedTerminalLayout();
				set(() => makeDefaultState());
			},
		}),
		{
			name: TERMINAL_LAYOUT_STORAGE_KEY,
			version: TERMINAL_LAYOUT_PERSIST_VERSION,
			storage: terminalLayoutLocalStorage,
			partialize: partializeTerminalStore,
			onRehydrateStorage: () => (state, error) =>
				handleTerminalStoreRehydrate(state as TerminalsStore | undefined, error),
		},
	),
);
