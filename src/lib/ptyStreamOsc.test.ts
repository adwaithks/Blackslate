import { describe, expect, it } from "vitest";
import {
	pullOscSideEffects,
	stripClaudeWindowTitlePrefix,
} from "./ptyStreamOsc";

describe("pullOscSideEffects", () => {
	const home = "/Users/me";

	it("emits multiple OSC in stream order", () => {
		const chunk =
			"\x1b]6973;running\x07" +
			"text\x1b]6973;prompt\x07" +
			"\x1b]6974;waiting\x07";
		expect(pullOscSideEffects(chunk, home)).toEqual([
			{ type: "shell_state", state: "running" },
			{ type: "shell_state", state: "idle" },
			{ type: "claude_lifecycle", lifecycle: "waiting" },
		]);
	});

	it("parses OSC 7 cwd", () => {
		const chunk = "\x1b]7;file://box/Users/me/proj\x07";
		expect(pullOscSideEffects(chunk, home)).toEqual([
			{ type: "cwd", path: "~/proj" },
		]);
	});

	it("parses OSC 6977 session model", () => {
		expect(
			pullOscSideEffects("\x1b]6977;claude-sonnet-4-20250514\x07", home),
		).toEqual([
			{ type: "session_model", model: "claude-sonnet-4-20250514" },
		]);
	});

	it("ignores empty 6977 payload", () => {
		expect(pullOscSideEffects("\x1b]6977;\x07", home)).toEqual([]);
	});
});

describe("stripClaudeWindowTitlePrefix", () => {
	it("drops leading symbols and keeps the rest of the title", () => {
		expect(stripClaudeWindowTitlePrefix("✳ New coding session")).toBe(
			"New coding session",
		);
		expect(stripClaudeWindowTitlePrefix("⠂⠄ My app")).toBe("My app");
	});

	it("preserves hyphens and spaces after the real start", () => {
		expect(stripClaudeWindowTitlePrefix("· foo-bar baz")).toBe("foo-bar baz");
	});

	it("handles titles that start with a digit", () => {
		expect(stripClaudeWindowTitlePrefix("✳ 2nd try")).toBe("2nd try");
	});

	it("returns empty when there is no letter or digit", () => {
		expect(stripClaudeWindowTitlePrefix("⠂⠂·")).toBe("");
	});
});