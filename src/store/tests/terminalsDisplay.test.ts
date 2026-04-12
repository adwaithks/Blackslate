import { describe, expect, it } from "vitest";

import {
	cwdToAbsolute,
	shortCwdLabel,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/terminalsDisplay";
import { makeTerminal, makeWorkspace } from "@/test/terminalFixtures";

describe("shortCwdLabel", () => {
	it("returns ~ and / unchanged", () => {
		expect(shortCwdLabel(makeTerminal({ id: "a", cwd: "~" }))).toBe("~");
		expect(shortCwdLabel(makeTerminal({ id: "b", cwd: "/" }))).toBe("/");
	});

	it("uses the last non-empty path segment", () => {
		expect(
			shortCwdLabel(
				makeTerminal({ id: "1", cwd: "/Users/dev/Projects/Slate" }),
			),
		).toBe("Slate");
		expect(
			shortCwdLabel(makeTerminal({ id: "2", cwd: "~/Projects/Slate" })),
		).toBe("Slate");
	});

	it("treats empty cwd as ~", () => {
		expect(shortCwdLabel(makeTerminal({ id: "x", cwd: "" }))).toBe("~");
	});

	it("handles trailing slashes on paths", () => {
		expect(shortCwdLabel(makeTerminal({ id: "t", cwd: "/var/log/" }))).toBe(
			"log",
		);
	});
});

describe("terminalDisplayName", () => {
	it("prefers customName when set", () => {
		expect(
			terminalDisplayName(
				makeTerminal({
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
				makeTerminal({
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
				makeTerminal({
					id: "s",
					claudeSessionTitle: "",
					cwd: "/opt/tools",
				}),
			),
		).toBe("tools");
	});

	it("falls back to shortCwdLabel when no custom title", () => {
		expect(terminalDisplayName(makeTerminal({ id: "s", cwd: "~/src" }))).toBe(
			"src",
		);
	});
});

describe("workspaceDisplayName", () => {
	const tabA = makeTerminal({ id: "a", cwd: "/one" });
	const tabB = makeTerminal({ id: "b", cwd: "/two" });

	it("uses workspace customName when set", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					customName: "Backend",
					terminals: [tabA, tabB],
					activeTerminalId: "b",
				}),
			),
		).toBe("Backend");
	});

	it("uses the active terminal’s display name", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					terminals: [tabA, tabB],
					activeTerminalId: "b",
				}),
			),
		).toBe("two");
	});

	it("falls back to the first terminal when activeTerminalId is missing", () => {
		const lone = makeTerminal({
			id: "only",
			customName: "Pinned",
			cwd: "/x",
		});
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					terminals: [lone],
					activeTerminalId: "ghost",
				}),
			),
		).toBe("Pinned");
	});

	it("returns ~ when there are no terminals", () => {
		expect(
			workspaceDisplayName(
				makeWorkspace({
					id: "ws",
					terminals: [],
					activeTerminalId: "n/a",
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
