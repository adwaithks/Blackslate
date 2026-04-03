import { describe, expect, it } from "vitest";

import {
	cwdToAbsolute,
	sessionDisplayName,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/sessionsDisplay";
import { makeSession, makeWorkspace } from "@/test/sessionFixtures";

describe("sessionDisplayName", () => {
	it("returns ~ and / unchanged", () => {
		expect(sessionDisplayName(makeSession({ id: "a", cwd: "~" }))).toBe("~");
		expect(sessionDisplayName(makeSession({ id: "b", cwd: "/" }))).toBe("/");
	});

	it("uses the last non-empty path segment", () => {
		expect(
			sessionDisplayName(
				makeSession({ id: "1", cwd: "/Users/dev/Projects/Slate" }),
			),
		).toBe("Slate");
		expect(
			sessionDisplayName(makeSession({ id: "2", cwd: "~/Projects/Slate" })),
		).toBe("Slate");
	});

	it("treats empty cwd as ~", () => {
		expect(sessionDisplayName(makeSession({ id: "x", cwd: "" }))).toBe("~");
	});

	it("handles trailing slashes on paths", () => {
		expect(sessionDisplayName(makeSession({ id: "t", cwd: "/var/log/" }))).toBe(
			"log",
		);
	});
});

describe("terminalDisplayName", () => {
	it("prefers customName when set", () => {
		expect(
			terminalDisplayName(
				makeSession({
					id: "s",
					customName: "My tab",
					claudeSessionTitle: "Claude title",
					cwd: "/tmp",
				}),
			),
		).toBe("My tab");
	});

	it("uses claudeSessionTitle when customName is null", () => {
		expect(
			terminalDisplayName(
				makeSession({
					id: "s",
					claudeSessionTitle: "Fix auth bug",
					cwd: "/projects/app",
				}),
			),
		).toBe("Fix auth bug");
	});

	it("ignores empty claudeSessionTitle and falls back to cwd label", () => {
		expect(
			terminalDisplayName(
				makeSession({
					id: "s",
					claudeSessionTitle: "",
					cwd: "/opt/tools",
				}),
			),
		).toBe("tools");
	});

	it("falls back to sessionDisplayName when no custom title", () => {
		expect(terminalDisplayName(makeSession({ id: "s", cwd: "~/src" }))).toBe(
			"src",
		);
	});
});

describe("workspaceDisplayName", () => {
	const tabA = makeSession({ id: "a", cwd: "/one" });
	const tabB = makeSession({ id: "b", cwd: "/two" });

	it("uses workspace customName when set", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					customName: "Backend",
					sessions: [tabA, tabB],
					activeSessionId: "b",
				}),
			),
		).toBe("Backend");
	});

	it("uses the active session’s terminalDisplayName", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					sessions: [tabA, tabB],
					activeSessionId: "b",
				}),
			),
		).toBe("two");
	});

	it("falls back to the first session when activeSessionId is missing", () => {
		const lone = makeSession({
			id: "only",
			customName: "Pinned",
			cwd: "/x",
		});
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					sessions: [lone],
					activeSessionId: "ghost",
				}),
			),
		).toBe("Pinned");
	});

	it("returns ~ when there are no sessions", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					sessions: [],
					activeSessionId: "n/a",
				}),
			),
		).toBe("~");
	});
});

describe("cwdToAbsolute", () => {
	it("maps ~ and empty cwd to home without a trailing slash", () => {
		expect(cwdToAbsolute("~", "/Users/dev")).toBe("/Users/dev");
		expect(cwdToAbsolute("", "/Users/dev")).toBe("/Users/dev");
	});

	it("strips a trailing slash from home before joining", () => {
		expect(cwdToAbsolute("~", "/Users/dev/")).toBe("/Users/dev");
	});

	it("expands ~/ segments", () => {
		expect(cwdToAbsolute("~/Projects/Slate", "/Users/dev")).toBe(
			"/Users/dev/Projects/Slate",
		);
	});

	it("leaves non-tilde paths unchanged", () => {
		expect(cwdToAbsolute("/usr/local", "/Users/dev")).toBe("/usr/local");
	});
});
