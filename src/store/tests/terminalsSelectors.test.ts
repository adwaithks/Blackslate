import { describe, expect, it } from "vitest";

import {
	findTerminal,
	selectActiveTerminal,
	selectActiveWorkspace,
	selectActiveWorkspaceTabBarSignature,
	selectAppHeaderSlice,
	selectTerminalCwd,
	selectSidebarDisplaySignature,
} from "@/store/terminalsSelectors";
import type { TerminalsState } from "@/store/terminalsTypes";
import { makeTerminal, makeWorkspace } from "@/test/terminalFixtures";

describe("selectActiveWorkspace", () => {
	const ws1 = makeWorkspace({
		id: "w1",
		terminals: [makeTerminal({ id: "s1" })],
		activeTerminalId: "s1",
	});
	const ws2 = makeWorkspace({
		id: "w2",
		terminals: [makeTerminal({ id: "s2" })],
		activeTerminalId: "s2",
	});

	it("returns the workspace whose id matches activeWorkspaceId", () => {
		expect(
			selectActiveWorkspace({
				workspaces: [ws1, ws2],
				activeWorkspaceId: "w2",
			}),
		).toBe(ws2);
	});

	it("returns undefined when the id is missing", () => {
		expect(
			selectActiveWorkspace({
				workspaces: [ws1],
				activeWorkspaceId: "ghost",
			}),
		).toBeUndefined();
	});

	it("returns undefined for an empty workspace list", () => {
		expect(
			selectActiveWorkspace({
				workspaces: [],
				activeWorkspaceId: "w1",
			}),
		).toBeUndefined();
	});
});

describe("selectActiveTerminal", () => {
	const tabA = makeTerminal({ id: "a", cwd: "/a" });
	const tabB = makeTerminal({ id: "b", cwd: "/b" });
	const ws = makeWorkspace({
		id: "ws",
		terminals: [tabA, tabB],
		activeTerminalId: "b",
	});

	it("returns the active terminal inside the active workspace", () => {
		// internally selectActiveTerminal calls selectActiveWorkspace
		// to get the active workspace, and then it finds the active terminal
		// inside the active workspace.
		expect(
			selectActiveTerminal({
				workspaces: [ws],
				activeWorkspaceId: "ws",
			}),
		).toBe(tabB);
	});

	it("returns undefined when there is no active workspace", () => {
		expect(
			selectActiveTerminal({
				workspaces: [ws],
				activeWorkspaceId: "other",
			}),
		).toBeUndefined();
	});

	it("returns undefined when activeTerminalId does not match any tab", () => {
		const broken = makeWorkspace({
			id: "ws",
			terminals: [tabA],
			activeTerminalId: "missing",
		});
		expect(
			selectActiveTerminal({
				workspaces: [broken],
				activeWorkspaceId: "ws",
			}),
		).toBeUndefined();
	});
});

describe("findTerminal", () => {
	const s1 = makeTerminal({ id: "s1" });
	const s2 = makeTerminal({ id: "s2" });
	const wsA = makeWorkspace({
		id: "a",
		terminals: [s1],
		activeTerminalId: "s1",
	});
	const wsB = makeWorkspace({
		id: "b",
		terminals: [s2],
		activeTerminalId: "s2",
	});

	it("returns the terminal when it exists in a workspace", () => {
		expect(findTerminal([wsA, wsB], "s2")).toBe(s2);
	});

	it("returns the first match when the same id could appear in multiple workspaces", () => {
		const dup = makeTerminal({ id: "same", cwd: "/first" });
		const other = makeTerminal({ id: "same", cwd: "/second" });
		const first = makeWorkspace({
			id: "w1",
			terminals: [dup],
			activeTerminalId: "same",
		});
		const second = makeWorkspace({
			id: "w2",
			terminals: [other],
			activeTerminalId: "same",
		});
		expect(findTerminal([first, second], "same")).toBe(dup);
	});

	it("returns undefined when the terminal id is not found", () => {
		expect(findTerminal([wsA, wsB], "nope")).toBeUndefined();
	});

	it("returns undefined for an empty workspace list", () => {
		expect(findTerminal([], "s1")).toBeUndefined();
	});
});

describe("selectTerminalCwd", () => {
	it("returns the tab cwd when the terminal exists", () => {
		const tab = makeTerminal({ id: "t1", cwd: "~/proj" });
		const ws = makeWorkspace({
			id: "w1",
			terminals: [tab],
			activeTerminalId: "t1",
		});
		const state = {
			workspaces: [ws],
			activeWorkspaceId: "w1",
		} as TerminalsState;
		expect(selectTerminalCwd(state, "t1")).toBe("~/proj");
	});

	it('returns "~" when the terminal id is not found', () => {
		const state = { workspaces: [], activeWorkspaceId: "" } as TerminalsState;
		expect(selectTerminalCwd(state, "missing")).toBe("~");
	});
});

describe("selectActiveWorkspaceTabBarSignature", () => {
	it("is unchanged when only shellState changes on the active tab", () => {
		const tab = makeTerminal({ id: "t1", shellState: "idle" });
		const ws = makeWorkspace({
			id: "w1",
			terminals: [tab],
			activeTerminalId: "t1",
		});
		const base = {
			workspaces: [ws],
			activeWorkspaceId: "w1",
		};
		const a = selectActiveWorkspaceTabBarSignature(base);
		const tabRunning = { ...tab, shellState: "running" as const };
		const ws2 = {
			...ws,
			panes: [{ ...ws.panes[0], terminals: [tabRunning] }],
		};
		const b = selectActiveWorkspaceTabBarSignature({
			workspaces: [ws2],
			activeWorkspaceId: "w1",
		});
		expect(a).toBe(b);
	});
});

describe("selectSidebarDisplaySignature", () => {
	it("is unchanged when only shellState changes", () => {
		const tab = makeTerminal({ id: "t1", shellState: "idle" });
		const ws = makeWorkspace({
			id: "w1",
			terminals: [tab],
			activeTerminalId: "t1",
		});
		const base = { workspaces: [ws], activeWorkspaceId: "w1" };
		const a = selectSidebarDisplaySignature(base);
		const tabRunning = { ...tab, shellState: "running" as const };
		const ws2 = {
			...ws,
			panes: [{ ...ws.panes[0], terminals: [tabRunning] }],
		};
		const b = selectSidebarDisplaySignature({
			workspaces: [ws2],
			activeWorkspaceId: "w1",
		});
		expect(a).toBe(b);
	});
});

describe("selectAppHeaderSlice", () => {
	it("is unchanged when only shellState changes", () => {
		const tab = makeTerminal({
			id: "t1",
			cwd: "~/proj",
			shellState: "idle",
			git: { branch: "main", dirty: false },
		});
		const ws = makeWorkspace({
			id: "w1",
			terminals: [tab],
			activeTerminalId: "t1",
		});
		const base = { workspaces: [ws], activeWorkspaceId: "w1" };
		const h1 = selectAppHeaderSlice(base);
		const tab2 = { ...tab, shellState: "running" as const };
		const ws2 = {
			...ws,
			panes: [{ ...ws.panes[0], terminals: [tab2] }],
		};
		const h2 = selectAppHeaderSlice({
			workspaces: [ws2],
			activeWorkspaceId: "w1",
		});
		expect(h1).toEqual(h2);
	});
});
