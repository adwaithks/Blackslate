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

	it("parses OSC 6976 with input, output tokens, cache reads and writes and model name", () => {
		const chunk =
			"\x1b]6976;in=1;out=2;cache_read=0;cache_write=0;model=m\x07";
		expect(pullOscSideEffects(chunk, home)).toEqual([
			{
				type: "turn_usage",
				usage: {
					inputTokens: 1,
					outputTokens: 2,
					cacheRead: 0,
					cacheWrite: 0,
				},
				model: "m",
			},
		]);
	});

	it("ignores empty 6976 payload", () => {
		expect(pullOscSideEffects("\x1b]6976;\x07", home)).toEqual([]);
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