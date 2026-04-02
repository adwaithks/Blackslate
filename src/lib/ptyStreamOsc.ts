/**
 * Parse **OSC** (Operating System Command) and related escape sequences from raw PTY
 * output before/after xterm renders it.
 *
 * ### Pipeline
 * Rust streams PTY bytes → base64 event → we decode to UTF-8 here (`usePty`) → xterm.write.
 *
 * ### Who emits what
 *
 * | Signal | Source | Notes |
 * |--------|--------|--------|
 * | **OSC 7** (`\e]7;file://…\a`) | zsh/bash **precmd** + **CwdChanged** hook | Shell reports cwd each prompt; `blackslate-cwd-changed` repeats the same sequence when Claude’s session cwd changes (e.g. tool `cd`) before the next prompt. |
 * | **OSC 6973** (`running` / `prompt`) | Same injected zsh hooks | `preexec` → running, `precmd` → idle at prompt. |
 * | **OSC 0 / 2** (window title) | Shell and Claude Code | Claude sets titled sessions and **empty title** to signal exit; we only trust session titles after we know Claude OSC is active. |
 * | **CSI … q** (DECSCUSR) | Shell | Cursor shape; stripped so xterm’s `cursorStyle` wins. |
 * | **6974 / 6975 / 6976 / 6977** | Hook scripts on disk | Rust writes `blackslate-*` in temp `ZDOTDIR`; the wrapped **`claude`** merges them via `--settings`. **6977** = SessionStart `model` field; **6976** = Stop + transcript usage and optional `model`. |
 *
 * Each parser uses its **own** `RegExp` (or `match` / `matchAll`) so we never rely on resetting
 * `lastIndex` on shared global regexes.
 */

import type { TurnUsage } from "@/store/sessions";

/** OSC 7 spans are short; rolling buffer cap in `usePty` avoids unbounded growth. */
export const OSC_ROLLING_BUFFER_MAX = 2048;

// --- CSI: cursor shape (shell), stripped before write ---

/** DECSCUSR — `\e[… q`. Shell sets block/underline/bar; xterm addon should own cursor style. */
export function stripShellCursorShapeSequences(text: string): string {
	return text.replace(/\x1b\[[0-9;]* ?q/g, "");
}

// --- OSC 7: cwd ---

/**
 * First OSC 7 in `chunk`: `ESC ] 7 ; file://host/path BEL` or `… ESC \`.
 * Returns store path (`~` when under `homePath`).
 */
export function parseOsc7WorkingDirectory(
	chunk: string,
	homePath: string,
): string | null {
	const m = chunk.match(/\x1b\]7;([^\x07\x1b]*?)(?:\x07|\x1b\\)/);
	if (!m) return null;
	try {
		const path = decodeURIComponent(new URL(m[1]).pathname);
		return path.startsWith(homePath)
			? "~" + path.slice(homePath.length)
			: path;
	} catch {
		return null;
	}
}

// --- Blackslate shell: OSC 6973 ---

export type ShellOscState = "running" | "idle";

/** First `6973;running` or `6973;prompt` (BEL-terminated) in this chunk. */
export function parseOsc6973ShellState(chunk: string): ShellOscState | null {
	const m = chunk.match(/\x1b\]6973;(running|prompt)\x07/);
	if (!m) return null;
	return m[1] === "running" ? "running" : "idle";
}

// --- Claude Code hooks: 6974–6977 (scripts in temp ZDOTDIR) ---

export type ClaudeLifecycleOsc = "thinking" | "waiting" | "complete";

export function parseOsc6974ClaudeLifecycle(
	chunk: string,
): ClaudeLifecycleOsc | null {
	const m = chunk.match(
		/\x1b\]6974;(thinking|waiting|complete)\x07/,
	);
	if (!m) return null;
	return m[1] as ClaudeLifecycleOsc;
}

/** Tool label from PreToolUse; empty payload means clear. No match → `undefined`. */
export function parseOsc6975ToolLabel(chunk: string): string | null | undefined {
	const m = chunk.match(/\x1b\]6975;([^\x07]*)\x07/);
	if (!m) return undefined;
	return m[1] || null;
}

export interface ParsedOsc6976 {
	usage: TurnUsage;
	/** When present, prefer over title-derived model. */
	model: string | undefined;
}

/** Stop hook: token line `in=…;out=…;cache_read=…;cache_write=…` and optional `model=`. */
export function parseOsc6976Usage(chunk: string): ParsedOsc6976 | null {
	const m = chunk.match(/\x1b\]6976;([^\x07]+)\x07/);
	if (!m) return null;
	const pairs = Object.fromEntries(
		m[1].split(";").map((p) => p.split("=")),
	);
	const usage: TurnUsage = {
		inputTokens: parseInt(pairs.in ?? "0", 10) || 0,
		outputTokens: parseInt(pairs.out ?? "0", 10) || 0,
		cacheRead: parseInt(pairs.cache_read ?? "0", 10) || 0,
		cacheWrite: parseInt(pairs.cache_write ?? "0", 10) || 0,
	};
	const model = pairs.model?.trim() || undefined;
	return { usage, model };
}

/** SessionStart hook: payload is the API model id only (no `;` in value). */
export function parseOsc6977SessionModel(chunk: string): string | null {
	const m = chunk.match(/\x1b\]6977;([^\x07]+)\x07/);
	if (!m) return null;
	const s = m[1].trim();
	return s || null;
}

// --- OSC 0 / 2: window title (multiple per chunk possible) ---

/**
 * Yields each raw title payload in order. Empty string is Claude’s “reset title” / exit hint.
 */
export function* eachOscWindowTitle(chunk: string): Generator<string> {
	const re = /\x1b\](?:0|2);([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
	for (const m of chunk.matchAll(re)) {
		yield m[1];
	}
}

/** Spinner / icon prefix on Claude’s OSC 0 titles, e.g. `✳ New coding session`. */
export function stripClaudeWindowTitlePrefix(title: string): string {
	return title.replace(
		/^[\s✳✻✽✶✢·⠂⠄⠆⠇⠏⠟⠿⠽⠹⠸⠼⠴⠤⠠⠐⠁]+/,
		"",
	);
}
