import { describe, expect, it } from "vitest";
import { decodePtyBase64PayloadChunk } from "./decodePtyBase64PayloadChunk";
import {
	claudeLifecycleFromOsc6974Payload,
	cwdFromOsc7Payload,
	isClaudeProductWindowTitle,
	shellStateFromOsc6973Payload,
	stripClaudeWindowTitlePrefix,
} from "./ptyStreamOsc";

describe("cwdFromOsc7Payload", () => {
	const home = "/Users/me";

	it("maps a file URL under home to tilde form", () => {
		expect(cwdFromOsc7Payload("file://box/Users/me/proj", home)).toBe(
			"~/proj",
		);
	});

	it("returns absolute path when outside home", () => {
		expect(cwdFromOsc7Payload("file://box/tmp/x", home)).toBe("/tmp/x");
	});

	it("returns null for invalid payloads", () => {
		expect(cwdFromOsc7Payload("not-a-url", home)).toBeNull();
	});

	it("normalizes HOME with a trailing slash so tilde cwd stays ~/proj", () => {
		expect(cwdFromOsc7Payload("file://h/Users/me/proj", "/Users/me/")).toBe(
			"~/proj",
		);
	});

	it("accepts a bare absolute path (no file:// scheme)", () => {
		expect(cwdFromOsc7Payload("/Users/me/proj", home)).toBe("~/proj");
	});
});

describe("shellStateFromOsc6973Payload", () => {
	it("trims trailing whitespace on running", () => {
		expect(shellStateFromOsc6973Payload("running ")).toBe("running");
	});
});

describe("claudeLifecycleFromOsc6974Payload", () => {
	it("preserves unknown lifecycle tokens", () => {
		expect(claudeLifecycleFromOsc6974Payload("paused_for_input")).toBe(
			"paused_for_input",
		);
	});

	it("returns null for empty payload", () => {
		expect(claudeLifecycleFromOsc6974Payload("   ")).toBeNull();
	});
});

describe("isClaudeProductWindowTitle", () => {
	it("matches localized Claude product titles", () => {
		const stripped = stripClaudeWindowTitlePrefix("✳ Claude コード");
		expect(stripped).toBe("Claude コード");
		expect(isClaudeProductWindowTitle(stripped)).toBe(true);
	});
});

// Same chunk-merging as the live terminal hook so tests match real behavior.
function mergePtyB64ChunksLikeUsePty(parts: string[]): string {
	const dec = new TextDecoder();
	let out = "";
	for (const b64 of parts) {
		out += decodePtyBase64PayloadChunk(dec, b64);
	}
	out += dec.decode();
	return out;
}

describe("PTY UTF-8 streaming decode (usePty)", () => {
	it("merges a 4-byte emoji when the PTY read cuts through the middle of its UTF-8", () => {
		const encoder = new TextEncoder();
		const emoji = "\u{1F600}";
		const emojiBytes = encoder.encode(emoji);
		expect(emojiBytes.length).toBe(4);

		const text = `before${emoji}after`;
		const fullBytes = encoder.encode(text);
		const i = fullBytes.indexOf(emojiBytes[0]);
		expect(i).toBeGreaterThanOrEqual(0);
		const splitInsideCodepoint = i + 2;
		const b64a = btoa(
			String.fromCharCode(...fullBytes.subarray(0, splitInsideCodepoint)),
		);
		const b64b = btoa(
			String.fromCharCode(...fullBytes.subarray(splitInsideCodepoint)),
		);
		expect(mergePtyB64ChunksLikeUsePty([b64a, b64b])).toBe(text);
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

	it("keeps an emoji-only session glyph after the spinner", () => {
		expect(stripClaudeWindowTitlePrefix("✳ \u{1F680}")).toBe("\u{1F680}");
	});
});
