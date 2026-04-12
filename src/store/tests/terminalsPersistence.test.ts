import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	TERMINAL_LAYOUT_PERSIST_VERSION,
	TERMINAL_LAYOUT_STORAGE_KEY,
} from "@/store/terminals";

function cwdOfFirstTab(state: {
	workspaces: Array<{
		id: string;
		activePaneId: string;
		panes: Array<{ id: string; terminals: Array<{ cwd: string }> }>;
	}>;
}): string {
	const ws = state.workspaces[0];
	if (!ws) return "";
	const pane =
		ws.panes.find((p) => p.id === ws.activePaneId) ?? ws.panes[0];
	return pane?.terminals[0]?.cwd ?? "";
}

describe("terminal layout persistence version", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	async function loadTerminalStore() {
		const { useTerminalStore } = await import("@/store/terminalsStore");
		await useTerminalStore.persist.rehydrate();
		return useTerminalStore;
	}

	it("drops malformed JSON and keeps the default layout", async () => {
		localStorage.setItem(TERMINAL_LAYOUT_STORAGE_KEY, "not-json{");
		const useTerminalStore = await loadTerminalStore();
		const s = useTerminalStore.getState();
		expect(s.workspaces).toHaveLength(1);
		expect(cwdOfFirstTab(s)).toBe("~");
		// Rehydrate applies defaults then `restoreFromLayout` persists a fresh v1 blob.
		const raw = localStorage.getItem(TERMINAL_LAYOUT_STORAGE_KEY);
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!).version).toBe(TERMINAL_LAYOUT_PERSIST_VERSION);
	});

	it("drops blob when version is missing", async () => {
		localStorage.setItem(
			TERMINAL_LAYOUT_STORAGE_KEY,
			JSON.stringify({
				state: {
					activeWorkspaceId: "ws-1",
					workspaces: [],
				},
			}),
		);
		const useTerminalStore = await loadTerminalStore();
		const s = useTerminalStore.getState();
		expect(s.workspaces).toHaveLength(1);
		expect(cwdOfFirstTab(s)).toBe("~");
		expect(JSON.parse(localStorage.getItem(TERMINAL_LAYOUT_STORAGE_KEY)!).version).toBe(
			TERMINAL_LAYOUT_PERSIST_VERSION,
		);
	});

	it("drops blob when version is stale", async () => {
		localStorage.setItem(
			TERMINAL_LAYOUT_STORAGE_KEY,
			JSON.stringify({
				state: {
					activeWorkspaceId: "ws-1",
					workspaces: [
						{
							id: "ws-1",
							customName: null,
							activePaneId: "pane-1",
							panes: [
								{
									id: "pane-1",
									activeTerminalId: "t-1",
									terminals: [
										{
											id: "t-1",
											customName: null,
											cwd: "/would-be-restored",
											createdAt: 1,
										},
									],
								},
							],
						},
					],
				},
				version: TERMINAL_LAYOUT_PERSIST_VERSION - 1,
			}),
		);
		const useTerminalStore = await loadTerminalStore();
		const s = useTerminalStore.getState();
		expect(s.workspaces).toHaveLength(1);
		expect(cwdOfFirstTab(s)).toBe("~");
		expect(
			JSON.parse(localStorage.getItem(TERMINAL_LAYOUT_STORAGE_KEY)!).version,
		).toBe(TERMINAL_LAYOUT_PERSIST_VERSION);
	});

	it("drops blob when version is newer than this app expects", async () => {
		localStorage.setItem(
			TERMINAL_LAYOUT_STORAGE_KEY,
			JSON.stringify({
				state: {
					activeWorkspaceId: "ws-future",
					workspaces: [
						{
							id: "ws-future",
							customName: null,
							activePaneId: "pane-1",
							panes: [
								{
									id: "pane-1",
									activeTerminalId: "t-1",
									terminals: [
										{
											id: "t-1",
											customName: null,
											cwd: "/from-future-app",
											createdAt: 1,
										},
									],
								},
							],
						},
					],
				},
				version: TERMINAL_LAYOUT_PERSIST_VERSION + 1,
			}),
		);
		const useTerminalStore = await loadTerminalStore();
		const s = useTerminalStore.getState();
		expect(s.workspaces).toHaveLength(1);
		expect(cwdOfFirstTab(s)).toBe("~");
		expect(s.workspaces.some((w) => w.id === "ws-future")).toBe(false);
	});

	it("hydrates layout when version matches current", async () => {
		const persisted = {
			activeWorkspaceId: "ws-persisted",
			workspaces: [
				{
					id: "ws-persisted",
					customName: null,
					activePaneId: "pane-1",
					panes: [
						{
							id: "pane-1",
							activeTerminalId: "t-1",
							terminals: [
								{
									id: "t-1",
									customName: null,
									cwd: "/from-local-storage",
									createdAt: 99,
								},
							],
						},
					],
				},
			],
		};
		localStorage.setItem(
			TERMINAL_LAYOUT_STORAGE_KEY,
			JSON.stringify({
				state: persisted,
				version: TERMINAL_LAYOUT_PERSIST_VERSION,
			}),
		);
		const useTerminalStore = await loadTerminalStore();
		const ws = useTerminalStore
			.getState()
			.workspaces.find((w) => w.id === "ws-persisted");
		expect(ws).toBeDefined();
		const tab = ws!.panes[0].terminals.find((t) => t.id === "t-1");
		expect(tab?.cwd).toBe("/from-local-storage");
	});
});
