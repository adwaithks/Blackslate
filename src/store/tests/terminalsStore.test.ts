import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Pane, Workspace } from "@/store/terminalsTypes";

type TerminalsStoreModule = typeof import("@/store/terminalsStore");

// Fixed ids for tests that expect "not found" (the real app never issues these).
const UNKNOWN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000099";
const UNKNOWN_TERMINAL_ID = "00000000-0000-4000-8000-000000000088";

let useTerminalStore: TerminalsStoreModule["useTerminalStore"];

beforeEach(async () => {
	localStorage.clear();
	vi.resetModules();
	// creates a brand new store instance for each test
	// since create() runs each time before each test
	// it also creates a workspace with one pane with one terminal with a default cwd of "~"
	({ useTerminalStore } = await import("@/store/terminalsStore"));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Tests assume one pane per workspace; this grabs the active (or first) pane without repeating lookups.
function pane(ws: Workspace): Pane {
	const p =
		ws.panes.find((x) => x.id === ws.activePaneId) ?? ws.panes[0];
	if (!p) {
		throw new Error("pane(): workspace has no panes");
	}
	return p;
}

function initialTab() {
	const ws = useTerminalStore.getState().workspaces[0];
	return pane(ws).terminals[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createWorkspace", () => {
	it("appends a workspace, activates it, and copies cwd from the previously active terminal", () => {
		const before = useTerminalStore.getState();
		expect(before.workspaces).toHaveLength(1);
		const firstWs = before.workspaces[0];
		const firstTab = pane(firstWs).terminals[0];

		useTerminalStore
			.getState()
			.setCwd(firstTab.id, "~/Projects/Foo/testing");
		useTerminalStore.getState().createWorkspace(); // create another workspace

		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(2); // now we have 2 workspaces
		expect(after.activeWorkspaceId).not.toBe(firstWs.id); // the new workspace is activated

		const newWs = after.workspaces.find(
			(w) => w.id === after.activeWorkspaceId,
		);
		expect(newWs).toBeDefined();
		expect(pane(newWs!).terminals).toHaveLength(1); // the new workspace has one terminal
		expect(pane(newWs!).terminals[0].cwd).toBe("~/Projects/Foo/testing"); // the terminal has the cwd of the previously active terminal
	});
});

describe("closeWorkspace", () => {
	it("does nothing when there is only one workspace", () => {
		const before = useTerminalStore.getState();
		expect(before.workspaces).toHaveLength(1);
		const id = before.workspaces[0].id;

		useTerminalStore.getState().closeWorkspace(id);

		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(1);
		expect(after.workspaces[0].id).toBe(id);
		expect(after.activeWorkspaceId).toBe(id);
	});

	it("removes a non-active workspace and keeps activeWorkspaceId", () => {
		useTerminalStore.getState().createWorkspace(); // create another workspace
		const mid = useTerminalStore.getState();
		expect(mid.workspaces).toHaveLength(2); // now we have 2 workspaces
		const [first, second] = mid.workspaces;
		expect(mid.activeWorkspaceId).toBe(second.id); // the second workspace is activated

		useTerminalStore.getState().closeWorkspace(first.id); // close the first workspace

		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(1); // now we have 1 workspace
		expect(after.workspaces[0].id).toBe(second.id);
		expect(after.activeWorkspaceId).toBe(second.id); // the second workspace is still activated
	});

	it("when closing the active workspace, activates the previous workspace in the list", () => {
		useTerminalStore.getState().createWorkspace();
		useTerminalStore.getState().createWorkspace();
		const mid = useTerminalStore.getState();
		expect(mid.workspaces).toHaveLength(3);
		const [w1, w2, w3] = mid.workspaces;
		expect(mid.activeWorkspaceId).toBe(w3.id); // the third workspace is activated, since it was created last

		useTerminalStore.getState().closeWorkspace(w3.id); // close the third workspace

		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(2); // now we have 2 workspaces
		expect(after.workspaces.map((w) => w.id)).toEqual([w1.id, w2.id]);
		expect(after.activeWorkspaceId).toBe(w2.id);
	});

	it("does not remove a workspace when workspaceId is unknown", () => {
		useTerminalStore.getState().createWorkspace();
		const before = useTerminalStore.getState();
		expect(before.workspaces).toHaveLength(2);

		useTerminalStore.getState().closeWorkspace(UNKNOWN_WORKSPACE_ID);

		const after = useTerminalStore.getState();
		expect(after.workspaces.map((w) => w.id)).toEqual(
			before.workspaces.map((w) => w.id),
		);
		expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
	});
});

describe("activateWorkspace", () => {
	it("sets activeWorkspaceId without changing the workspace list", () => {
		useTerminalStore.getState().createWorkspace();
		const mid = useTerminalStore.getState();
		const [first, second] = mid.workspaces;
		expect(mid.activeWorkspaceId).toBe(second.id);

		useTerminalStore.getState().activateWorkspace(first.id); // activate the first workspace

		const after = useTerminalStore.getState();
		expect(after.workspaces.map((w) => w.id)).toEqual([
			first.id,
			second.id,
		]);
		expect(after.activeWorkspaceId).toBe(first.id); // the first workspace is activated
	});

	it("does not change state when workspaceId does not exist", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().activateWorkspace(UNKNOWN_WORKSPACE_ID);
		const after = useTerminalStore.getState();
		expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
		expect(after.workspaces).toBe(before.workspaces);
	});
});

describe("createTerminalInWorkspace", () => {
	it("appends a terminal, makes it active, and copies cwd from the workspace active tab", () => {
		const { workspaces } = useTerminalStore.getState();
		expect(workspaces).toHaveLength(1);
		const ws = workspaces[0];
		const firstPane = pane(ws);
		const firstTab = firstPane.terminals[0];
		expect(firstPane.terminals).toHaveLength(1); // the workspace has one terminal/terminal
		expect(firstPane.activeTerminalId).toBe(firstTab.id); // the first terminal/terminal is active

		useTerminalStore.getState().setCwd(firstTab.id, "~/repo/app");
		useTerminalStore.getState().createTerminalInWorkspace(ws.id); // create another terminal/terminal in the same workspace

		const after = useTerminalStore.getState();
		const updated = after.workspaces.find((w) => w.id === ws.id);
		expect(updated).toBeDefined();
		const updatedPane = pane(updated!);
		expect(updatedPane.terminals).toHaveLength(2); // now the workspace has two sessions/terminals
		const newTab = updatedPane.terminals.find((s) => s.id !== firstTab.id);
		expect(newTab).toBeDefined();
		expect(updatedPane.activeTerminalId).toBe(newTab!.id); // the new terminal/terminal is active
		expect(newTab!.cwd).toBe("~/repo/app"); // the new terminal/terminal has the cwd of the previously active terminal/terminal
	});

	it("does not add a terminal when workspaceId is unknown", () => {
		const before = useTerminalStore.getState();
		const counts = before.workspaces.map((w) => pane(w).terminals.length);

		useTerminalStore
			.getState()
			.createTerminalInWorkspace(UNKNOWN_WORKSPACE_ID);

		const after = useTerminalStore.getState();
		expect(after.workspaces.map((w) => pane(w).terminals.length)).toEqual(counts);
		expect(after.workspaces.map((w) => w.id)).toEqual(
			before.workspaces.map((w) => w.id),
		);
	});
});

describe("closeTerminal", () => {
	it("no-ops when workspaceId is not found", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().closeTerminal(
			"00000000-0000-4000-8000-000000000001", // workspace id that does not exist
			pane(before.workspaces[0]).terminals[0].id,
		);
		const after = useTerminalStore.getState();
		expect(after.workspaces).toBe(before.workspaces);
	});

	it("no-ops when closing the only terminal of the only workspace", () => {
		const before = useTerminalStore.getState();
		const ws = before.workspaces[0];
		useTerminalStore.getState().closeTerminal(ws.id, pane(ws).terminals[0].id);
		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(1);
		expect(after.workspaces[0].id).toBe(ws.id);
		expect(pane(after.workspaces[0]).terminals).toHaveLength(1);
	});

	it("closing the only terminal of a workspace removes that workspace when another exists", () => {
		useTerminalStore.getState().createWorkspace();
		const mid = useTerminalStore.getState();
		const [first, second] = mid.workspaces;
		const onlyTab = pane(second).terminals[0];
		expect(mid.activeWorkspaceId).toBe(second.id);

		useTerminalStore.getState().closeTerminal(second.id, onlyTab.id);

		const after = useTerminalStore.getState();
		expect(after.workspaces).toHaveLength(1);
		expect(after.workspaces[0].id).toBe(first.id);
		expect(after.activeWorkspaceId).toBe(first.id);
	});

	it("does not remove a one-tab workspace when terminalId does not match that tab", () => {
		useTerminalStore.getState().createWorkspace();
		const before = useTerminalStore.getState();
		const [first, second] = before.workspaces;

		useTerminalStore.getState().closeTerminal(second.id, UNKNOWN_TERMINAL_ID);

		const after = useTerminalStore.getState();
		expect(after.workspaces.map((w) => w.id)).toEqual([
			first.id,
			second.id,
		]);
		expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
	});

	it("removes a non-active terminal and keeps activeTerminalId", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		const firstTab = pane(ws).terminals[0];
		useTerminalStore.getState().createTerminalInWorkspace(ws.id);
		const mid = useTerminalStore.getState();
		const w = mid.workspaces.find((x) => x.id === ws.id)!;
		const secondTab = pane(w).terminals.find((s) => s.id !== firstTab.id)!;
		expect(pane(w).activeTerminalId).toBe(secondTab.id);

		useTerminalStore.getState().closeTerminal(ws.id, firstTab.id);

		const after = useTerminalStore.getState();
		const w2 = after.workspaces.find((x) => x.id === ws.id)!;
		expect(pane(w2).terminals).toHaveLength(1);
		expect(pane(w2).terminals[0].id).toBe(secondTab.id);
		expect(pane(w2).activeTerminalId).toBe(secondTab.id);
	});

	it("when closing the active terminal, activates the previous terminal in that workspace", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		const firstTab = pane(ws).terminals[0];
		useTerminalStore.getState().createTerminalInWorkspace(ws.id);
		const mid = useTerminalStore.getState();
		const w = mid.workspaces.find((x) => x.id === ws.id)!;
		const secondTab = pane(w).terminals.find((s) => s.id !== firstTab.id)!;
		expect(pane(w).activeTerminalId).toBe(secondTab.id);

		useTerminalStore.getState().closeTerminal(ws.id, secondTab.id);

		const after = useTerminalStore.getState();
		const w2 = after.workspaces.find((x) => x.id === ws.id)!;
		expect(pane(w2).terminals).toHaveLength(1);
		expect(pane(w2).terminals[0].id).toBe(firstTab.id);
		expect(pane(w2).activeTerminalId).toBe(firstTab.id);
	});

	it("does not remove a terminal when terminalId is not in that workspace", () => {
		useTerminalStore.getState().createWorkspace();
		const mid = useTerminalStore.getState();
		const [first, second] = mid.workspaces;
		useTerminalStore.getState().createTerminalInWorkspace(first.id);
		const mid2 = useTerminalStore.getState();
		const f = mid2.workspaces.find((w) => w.id === first.id)!;
		const s = mid2.workspaces.find((w) => w.id === second.id)!;
		const tabInSecond = pane(s).terminals[0];
		const firstTabIds = pane(f).terminals.map((x) => x.id);

		useTerminalStore.getState().closeTerminal(first.id, tabInSecond.id);

		const after = useTerminalStore.getState();
		const f2 = after.workspaces.find((w) => w.id === first.id)!;
		const s2 = after.workspaces.find((w) => w.id === second.id)!;
		expect(pane(f2).terminals.map((x) => x.id).sort()).toEqual(
			firstTabIds.slice().sort(),
		);
		expect(pane(s2).terminals.map((x) => x.id)).toEqual([tabInSecond.id]);
	});

	it("does not remove a terminal when terminalId is unknown (but workspace exists)", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		useTerminalStore.getState().createTerminalInWorkspace(ws.id);
		const mid = useTerminalStore.getState();
		const w = mid.workspaces.find((x) => x.id === ws.id)!;
		expect(pane(w).terminals).toHaveLength(2); // the workspace has two sessions/terminals

		useTerminalStore.getState().closeTerminal(ws.id, UNKNOWN_TERMINAL_ID);

		const after = useTerminalStore.getState();
		const w2 = after.workspaces.find((x) => x.id === ws.id)!;
		expect(pane(w2).terminals).toHaveLength(2); // the workspace still has two sessions/terminals
		expect(pane(w2).terminals.map((s) => s.id).sort()).toEqual(
			pane(w).terminals.map((s) => s.id).sort(),
		);
		expect(pane(w2).activeTerminalId).toBe(pane(w).activeTerminalId); // the active terminal/terminal is still the same
	});
});

describe("activateTerminal", () => {
	it("sets the active tab within a workspace and focuses that workspace", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		const firstTab = pane(ws).terminals[0];
		useTerminalStore.getState().createTerminalInWorkspace(ws.id);
		const mid = useTerminalStore.getState();
		const w = mid.workspaces.find((x) => x.id === ws.id)!;
		const secondTab = pane(w).terminals.find((s) => s.id !== firstTab.id)!;
		expect(pane(w).activeTerminalId).toBe(secondTab.id);

		useTerminalStore.getState().activateTerminal(ws.id, firstTab.id);

		const after = useTerminalStore.getState();
		const w2 = after.workspaces.find((x) => x.id === ws.id)!;
		expect(pane(w2).activeTerminalId).toBe(firstTab.id);
		expect(after.activeWorkspaceId).toBe(ws.id);
	});

	it("does not change state when workspaceId does not exist", () => {
		const before = useTerminalStore.getState();
		const tabId = pane(before.workspaces[0]).terminals[0].id;

		useTerminalStore.getState().activateTerminal(UNKNOWN_WORKSPACE_ID, tabId);

		const after = useTerminalStore.getState();
		expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
		expect(after.workspaces).toBe(before.workspaces);
	});

	it("does not change state when terminalId is not in that workspace", () => {
		useTerminalStore.getState().createWorkspace();
		const mid = useTerminalStore.getState();
		const [first, second] = mid.workspaces;
		useTerminalStore.getState().createTerminalInWorkspace(first.id);
		const before = useTerminalStore.getState();
		const tabInSecond = pane(
			before.workspaces.find((w) => w.id === second.id)!,
		).terminals[0];

		useTerminalStore.getState().activateTerminal(first.id, tabInSecond.id);

		const after = useTerminalStore.getState();
		expect(after.workspaces).toBe(before.workspaces);
		expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
	});
});

describe("setCwd", () => {
	it("updates cwd on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setCwd(tab.id, "~/Projects/Blackslate");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.cwd,
		).toBe("~/Projects/Blackslate");
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setCwd(UNKNOWN_TERMINAL_ID, "/nope"); // set cwd on a terminal that does not exist
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces); // the workspaces REFERENCE is the same
	});
});

describe("setGit", () => {
	it("sets git info on the matching terminal", () => {
		const tab = initialTab();
		const git = { branch: "feature/x", dirty: true, root: "/repo", isWorktree: false };
		useTerminalStore.getState().setGit(tab.id, git);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(pane(ws).terminals.find((s) => s.id === tab.id)!.git).toEqual(git);
	});

	it("clears git when set to null", () => {
		const tab = initialTab();
		useTerminalStore.getState().setGit(tab.id, { branch: "main", dirty: false, root: "/repo", isWorktree: false });
		useTerminalStore.getState().setGit(tab.id, null);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(pane(ws).terminals.find((s) => s.id === tab.id)!.git).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setGit(UNKNOWN_TERMINAL_ID, { branch: "x", dirty: false, root: "/repo", isWorktree: false });
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setPtyId", () => {
	it("sets ptyId on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setPtyId(tab.id, "pty-abc");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(pane(ws).terminals.find((s) => s.id === tab.id)!.ptyId).toBe("pty-abc");
	});

	it("clears ptyId when set to null", () => {
		const tab = initialTab();
		useTerminalStore.getState().setPtyId(tab.id, "pty-abc");
		useTerminalStore.getState().setPtyId(tab.id, null);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(pane(ws).terminals.find((s) => s.id === tab.id)!.ptyId).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setPtyId(UNKNOWN_TERMINAL_ID, "x");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setClaudeCodeActive", () => {
	it("updates claudeCodeActive on the matching terminal", () => {
		const tab = initialTab();
		expect(tab.claudeCodeActive).toBe(false);
		useTerminalStore.getState().setClaudeCodeActive(tab.id, true);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeCodeActive,
		).toBe(true);
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setClaudeCodeActive(UNKNOWN_TERMINAL_ID, true);
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setClaudeState", () => {
	it("updates claudeState on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeState(tab.id, "thinking");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeState,
		).toBe("thinking");
	});

	it("allows null", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeState(tab.id, "complete");
		useTerminalStore.getState().setClaudeState(tab.id, null);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeState,
		).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setClaudeState(UNKNOWN_TERMINAL_ID, "waiting");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setClaudeSessionTitle", () => {
	it("updates claudeSessionTitle on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeSessionTitle(tab.id, "Refactor store");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeSessionTitle,
		).toBe("Refactor store");
	});

	it("clears title when set to null", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeSessionTitle(tab.id, "T");
		useTerminalStore.getState().setClaudeSessionTitle(tab.id, null);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeSessionTitle,
		).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setClaudeSessionTitle(UNKNOWN_TERMINAL_ID, "nope");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setClaudeModel", () => {
	it("updates claudeModel on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeModel(tab.id, "claude-3-5-sonnet");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeModel,
		).toBe("claude-3-5-sonnet");
	});

	it("clears model when set to null", () => {
		const tab = initialTab();
		useTerminalStore.getState().setClaudeModel(tab.id, "m");
		useTerminalStore.getState().setClaudeModel(tab.id, null);
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.claudeModel,
		).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setClaudeModel(UNKNOWN_TERMINAL_ID, "x");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setTerminalCustomName", () => {
	it("stores a trimmed custom name", () => {
		const tab = initialTab();
		useTerminalStore.getState().setTerminalCustomName(tab.id, "  My tab  ");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.customName,
		).toBe("My tab");
	});

	it("clears customName for null, empty string, or whitespace-only", () => {
		const tab = initialTab();
		useTerminalStore.getState().setTerminalCustomName(tab.id, "Named");
		useTerminalStore.getState().setTerminalCustomName(tab.id, "");
		const ws1 = useTerminalStore.getState().workspaces[0];
		expect(pane(ws1).terminals.find((s) => s.id === tab.id)!.customName).toBeNull();

		useTerminalStore.getState().setTerminalCustomName(tab.id, "N2");
		useTerminalStore.getState().setTerminalCustomName(tab.id, "   ");
		const ws2 = useTerminalStore.getState().workspaces[0];
		expect(pane(ws2).terminals.find((s) => s.id === tab.id)!.customName).toBeNull();

		useTerminalStore.getState().setTerminalCustomName(tab.id, "N3");
		useTerminalStore.getState().setTerminalCustomName(tab.id, null);
		const ws3 = useTerminalStore.getState().workspaces[0];
		expect(pane(ws3).terminals.find((s) => s.id === tab.id)!.customName).toBeNull();
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setTerminalCustomName(UNKNOWN_TERMINAL_ID, "ghost");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setShellState", () => {
	it("updates shellState on the matching terminal", () => {
		const tab = initialTab();
		useTerminalStore.getState().setShellState(tab.id, "running");
		const ws = useTerminalStore.getState().workspaces[0];
		expect(
			pane(ws).terminals.find((s) => s.id === tab.id)!.shellState,
		).toBe("running");
	});

	it("does not change workspaces when terminalId is unknown", () => {
		const before = useTerminalStore.getState();
		useTerminalStore.getState().setShellState(UNKNOWN_TERMINAL_ID, "running");
		expect(useTerminalStore.getState().workspaces).toBe(before.workspaces);
	});
});

describe("setWorkspaceCustomName", () => {
	it("stores a trimmed workspace custom name", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "  Side project  ");
		expect(
			useTerminalStore.getState().workspaces.find((w) => w.id === ws.id)!
				.customName,
		).toBe("Side project");
	});

	it("clears customName for null, empty string, or whitespace-only", () => {
		const ws = useTerminalStore.getState().workspaces[0];
		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "Named");
		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "");
		expect(
			useTerminalStore.getState().workspaces.find((w) => w.id === ws.id)!.customName,
		).toBeNull();

		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "N2");
		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "   ");
		expect(
			useTerminalStore.getState().workspaces.find((w) => w.id === ws.id)!.customName,
		).toBeNull();

		useTerminalStore.getState().setWorkspaceCustomName(ws.id, "N3");
		useTerminalStore.getState().setWorkspaceCustomName(ws.id, null);
		expect(
			useTerminalStore.getState().workspaces.find((w) => w.id === ws.id)!.customName,
		).toBeNull();
	});

	it("does not change any workspace customName when workspaceId is unknown", () => {
		useTerminalStore.getState().createWorkspace();
		const before = useTerminalStore.getState();
		const namesBefore = before.workspaces.map((w) => w.customName);

		useTerminalStore
			.getState()
			.setWorkspaceCustomName(UNKNOWN_WORKSPACE_ID, "ghost");

		const after = useTerminalStore.getState();
		expect(after.workspaces.map((w) => w.customName)).toEqual(namesBefore);
	});
});
