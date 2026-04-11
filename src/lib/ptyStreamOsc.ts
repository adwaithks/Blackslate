/**
 * PTY stream helpers: strip cursor CSI for xterm, map OSC codes to UI effects.
 * Uses [`@ansi-tools/parser`](https://www.npmjs.com/package/@ansi-tools/parser) per chunk
 * (same as prior regex-on-chunk behavior: a split OSC across reads can be missed).
 */

import { parse } from "@ansi-tools/parser";

/** DECSCUSR — `\e[… q`. Strip so xterm’s cursor style wins. */
export function stripShellCursorShapeSequences(text: string): string {
	return text.replace(/\x1b\[[0-9;]* ?q/g, "");
}

export type ShellOscState = "running" | "idle";
export type ClaudeLifecycleOsc = "thinking" | "waiting" | "complete";

export type OscEffect =
	| { type: "shell_state"; state: ShellOscState }
	| { type: "cwd"; path: string }
	| { type: "claude_lifecycle"; lifecycle: ClaudeLifecycleOsc }
	| { type: "session_model"; model: string }
	| { type: "window_title"; raw: string };

function cwdFromOsc7Payload(filePayload: string, homePath: string): string | null {
	try {
		const path = decodeURIComponent(new URL(filePayload).pathname);
		return path.startsWith(homePath)
			? "~" + path.slice(homePath.length)
			: path;
	} catch {
		return null;
	}
}

/** Ordered OSC-driven updates for one decoded PTY chunk. */
export function pullOscSideEffects(
	chunk: string,
	homePath: string,
): OscEffect[] {
	const effects: OscEffect[] = [];
	for (const c of parse(chunk)) {
		if (c.type !== "OSC") continue;
		const joined = c.params.join(";");

		switch (c.command) {
			case "6973":
				if (joined === "running") effects.push({ type: "shell_state", state: "running" });
				else if (joined === "prompt") effects.push({ type: "shell_state", state: "idle" });
				break;
			case "7": {
				const cwd = cwdFromOsc7Payload(joined, homePath);
				if (cwd !== null) effects.push({ type: "cwd", path: cwd });
				break;
			}
			case "6974":
				if (joined === "thinking" || joined === "waiting" || joined === "complete") {
					effects.push({ type: "claude_lifecycle", lifecycle: joined });
				}
				break;
			case "6977": {
				const m = joined.trim();
				if (m) effects.push({ type: "session_model", model: m });
				break;
			}
			case "0":
			case "2":
				effects.push({ type: "window_title", raw: joined });
				break;
			default:
				break;
		}
	}
	return effects;
}

/**
 * Claude prefixes OSC 0/2 titles with spinner / braille / symbols. Drop that noise by
 * keeping the title from the first Unicode letter or digit onward (spaces etc. after
 * that stay intact).
 */
export function stripClaudeWindowTitlePrefix(title: string): string {
	const i = title.search(/[\p{L}\p{N}]/u);
	if (i === -1) return "";
	return title.slice(i).trimEnd();
}
