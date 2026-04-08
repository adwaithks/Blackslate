import { describe, expect, it } from "vitest";

import { patchSessionById } from "@/store/sessionsStore";
import { makeSession, makeWorkspace } from "@/test/sessionFixtures";

describe("patchSessionById", () => {
	it("returns the same workspaces reference when the new cwd equals the current value", () => {
		const tab = makeSession({ id: "tab-1", cwd: "/same" });
		const ws = makeWorkspace({
			id: "ws-1",
			sessions: [tab],
			activeSessionId: tab.id,
		});
		const workspaces = [ws];

		const next = patchSessionById(workspaces, "tab-1", "cwd", "/same");

		expect(next).toBe(workspaces);
	});

	it("returns the same workspaces reference when sessionId is not found", () => {
		const tab = makeSession({ id: "tab-1" });
		const ws = makeWorkspace({
			id: "ws-1",
			sessions: [tab],
			activeSessionId: tab.id,
		});
		const workspaces = [ws];

		const next = patchSessionById(
			workspaces,
			"00000000-0000-4000-8000-000000000099", // session id that does not exist
			"cwd",
			"/nope",
		);

		expect(next).toBe(workspaces); // the workspaces reference is the same
	});

	it("updates only the matching session and keeps sibling session object references", () => {
		const tabA = makeSession({ id: "a", cwd: "~" });
		const tabB = makeSession({ id: "b", cwd: "/unchanged" });
		const ws = makeWorkspace({
			id: "ws-1",
			sessions: [tabA, tabB],
			activeSessionId: tabB.id,
		});

		// patch the session with id "a" with the key = cwd and value = "~/patched"
		const next = patchSessionById([ws], "a", "cwd", "~/patched");

		const w = next[0];
		expect(w).not.toBe(ws); // not same object reference, since the session was found and was updated
		const patched = w.sessions.find((s) => s.id === "a")!;
		expect(patched.cwd).toBe("~/patched"); // the session was updated with the new value
		expect(w.sessions.find((s) => s.id === "b")).toBe(tabB);
	});

	it("leaves other workspaces as the same object references when they do not contain the session", () => {
		const tabA = makeSession({ id: "a" });
		const wsA = makeWorkspace({
			id: "ws-a",
			sessions: [tabA],
			activeSessionId: tabA.id,
		});
		const tabB = makeSession({ id: "b", cwd: "/before" });
		const wsB = makeWorkspace({
			id: "ws-b",
			sessions: [tabB],
			activeSessionId: tabB.id,
		});

		const workspaces = [wsA, wsB];
		const next = patchSessionById(workspaces, "b", "cwd", "/after");

		expect(next[0]).toBe(wsA);
		expect(next[1]).not.toBe(wsB);
		expect(next[1].sessions[0].cwd).toBe("/after");
	});

	it("patches every workspace that contains the same session id (pathological duplicate ids)", () => {
		const dupId = "duplicate-id";
		const tab1 = makeSession({ id: dupId, cwd: "/one" });
		const tab2 = makeSession({ id: dupId, cwd: "/two" });
		const ws1 = makeWorkspace({
			id: "ws-1",
			sessions: [tab1],
			activeSessionId: dupId,
		});
		const ws2 = makeWorkspace({
			id: "ws-2",
			sessions: [tab2],
			activeSessionId: dupId,
		});

		const next = patchSessionById([ws1, ws2], dupId, "cwd", "/both");

		expect(next[0].sessions[0].cwd).toBe("/both");
		expect(next[1].sessions[0].cwd).toBe("/both");
	});
});
