import { describe, expect, it } from "vitest";

import {
	findSession,
	selectActiveSession,
	selectActiveWorkspace,
} from "@/store/sessionsSelectors";
import { makeSession, makeWorkspace } from "@/test/sessionFixtures";

describe("selectActiveWorkspace", () => {
	const ws1 = makeWorkspace({
		id: "w1",
		sessions: [makeSession({ id: "s1" })],
		activeSessionId: "s1",
	});
	const ws2 = makeWorkspace({
		id: "w2",
		sessions: [makeSession({ id: "s2" })],
		activeSessionId: "s2",
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

describe("selectActiveSession", () => {
	const tabA = makeSession({ id: "a", cwd: "/a" });
	const tabB = makeSession({ id: "b", cwd: "/b" });
	const ws = makeWorkspace({
		id: "ws",
		sessions: [tabA, tabB],
		activeSessionId: "b",
	});

	it("returns the active session inside the active workspace", () => {
		// internally selectActiveSession calls selectActiveWorkspace
		// to get the active workspace, and then it finds the active session
		// inside the active workspace.
		expect(
			selectActiveSession({
				workspaces: [ws],
				activeWorkspaceId: "ws",
			}),
		).toBe(tabB);
	});

	it("returns undefined when there is no active workspace", () => {
		expect(
			selectActiveSession({
				workspaces: [ws],
				activeWorkspaceId: "other",
			}),
		).toBeUndefined();
	});

	it("returns undefined when activeSessionId does not match any tab", () => {
		const broken = makeWorkspace({
			id: "ws",
			sessions: [tabA],
			activeSessionId: "missing",
		});
		expect(
			selectActiveSession({
				workspaces: [broken],
				activeWorkspaceId: "ws",
			}),
		).toBeUndefined();
	});
});

describe("findSession", () => {
	const s1 = makeSession({ id: "s1" });
	const s2 = makeSession({ id: "s2" });
	const wsA = makeWorkspace({
		id: "a",
		sessions: [s1],
		activeSessionId: "s1",
	});
	const wsB = makeWorkspace({
		id: "b",
		sessions: [s2],
		activeSessionId: "s2",
	});

	it("returns the session when it exists in a workspace", () => {
		expect(findSession([wsA, wsB], "s2")).toBe(s2);
	});

	it("returns the first match when the same id could appear in multiple workspaces", () => {
		const dup = makeSession({ id: "same", cwd: "/first" });
		const other = makeSession({ id: "same", cwd: "/second" });
		const first = makeWorkspace({
			id: "w1",
			sessions: [dup],
			activeSessionId: "same",
		});
		const second = makeWorkspace({
			id: "w2",
			sessions: [other],
			activeSessionId: "same",
		});
		expect(findSession([first, second], "same")).toBe(dup);
	});

	it("returns undefined when the session id is not found", () => {
		expect(findSession([wsA, wsB], "nope")).toBeUndefined();
	});

	it("returns undefined for an empty workspace list", () => {
		expect(findSession([], "s1")).toBeUndefined();
	});
});
