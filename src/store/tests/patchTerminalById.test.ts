import { describe, expect, it } from "vitest";

import { patchTerminalById } from "@/store/terminalsStore";
import { makeTerminal, makeWorkspace } from "@/test/terminalFixtures";

describe("patchTerminalById", () => {
	it("returns the same workspaces reference when the new cwd equals the current value", () => {
		const tab = makeTerminal({ id: "tab-1", cwd: "/same" });
		const ws = makeWorkspace({
			id: "ws-1",
			terminals: [tab],
			activeTerminalId: tab.id,
		});
		const workspaces = [ws];

		const next = patchTerminalById(workspaces, "tab-1", "cwd", "/same");

		expect(next).toBe(workspaces);
	});

	it("returns the same workspaces reference when terminalId is not found", () => {
		const tab = makeTerminal({ id: "tab-1" });
		const ws = makeWorkspace({
			id: "ws-1",
			terminals: [tab],
			activeTerminalId: tab.id,
		});
		const workspaces = [ws];

		const next = patchTerminalById(
			workspaces,
			"00000000-0000-4000-8000-000000000099", // terminal id that does not exist
			"cwd",
			"/nope",
		);

		expect(next).toBe(workspaces); // the workspaces reference is the same
	});

	it("updates only the matching terminal and keeps sibling terminal object references", () => {
		const tabA = makeTerminal({ id: "a", cwd: "~" });
		const tabB = makeTerminal({ id: "b", cwd: "/unchanged" });
		const ws = makeWorkspace({
			id: "ws-1",
			terminals: [tabA, tabB],
			activeTerminalId: tabB.id,
		});

		// patch the terminal with id "a" with the key = cwd and value = "~/patched"
		const next = patchTerminalById([ws], "a", "cwd", "~/patched");

		const w = next[0];
		expect(w).not.toBe(ws); // not same object reference, since the terminal was found and was updated
		const patched = w.panes[0].terminals.find((s) => s.id === "a")!;
		expect(patched.cwd).toBe("~/patched"); // the terminal was updated with the new value
		expect(w.panes[0].terminals.find((s) => s.id === "b")).toBe(tabB);
	});

	it("leaves other workspaces as the same object references when they do not contain the terminal", () => {
		const tabA = makeTerminal({ id: "a" });
		const wsA = makeWorkspace({
			id: "ws-a",
			terminals: [tabA],
			activeTerminalId: tabA.id,
		});
		const tabB = makeTerminal({ id: "b", cwd: "/before" });
		const wsB = makeWorkspace({
			id: "ws-b",
			terminals: [tabB],
			activeTerminalId: tabB.id,
		});

		const workspaces = [wsA, wsB];
		const next = patchTerminalById(workspaces, "b", "cwd", "/after");

		expect(next[0]).toBe(wsA);
		expect(next[1]).not.toBe(wsB);
		expect(next[1].panes[0].terminals[0].cwd).toBe("/after");
	});

	it("patches every workspace that contains the same terminal id (pathological duplicate ids)", () => {
		const dupId = "duplicate-id";
		const tab1 = makeTerminal({ id: dupId, cwd: "/one" });
		const tab2 = makeTerminal({ id: dupId, cwd: "/two" });
		const ws1 = makeWorkspace({
			id: "ws-1",
			terminals: [tab1],
			activeTerminalId: dupId,
		});
		const ws2 = makeWorkspace({
			id: "ws-2",
			terminals: [tab2],
			activeTerminalId: dupId,
		});

		const next = patchTerminalById([ws1, ws2], dupId, "cwd", "/both");

		expect(next[0].panes[0].terminals[0].cwd).toBe("/both");
		expect(next[1].panes[0].terminals[0].cwd).toBe("/both");
	});
});
