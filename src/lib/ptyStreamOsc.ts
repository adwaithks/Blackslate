/**
 * PTY stream helpers: OSC 7 → display cwd for session UI; Claude window-title cleanup.
 * OSC 6973 / 6974 / 6977 / window title are handled by xterm (`registerOscHandler`, `onTitleChange`) in `usePty`.
 */

function tildeHomePath(path: string, homePath: string): string {
	const homeNorm = homePath.replace(/\/+$/, "");
	if (!homeNorm) return path;
	if (path === homeNorm) return "~";
	if (path.startsWith(homeNorm + "/")) {
		return "~" + path.slice(homeNorm.length);
	}
	return path;
}

/**
 * Map OSC 7 payload to a cwd string (tilde when under `homePath`).
 * Accepts `file://…` URLs and bare absolute paths (e.g. `/Users/me/proj`).
 */
export function cwdFromOsc7Payload(
	filePayload: string,
	homePath: string,
): string | null {
	const trimmed = filePayload.trim();
	if (trimmed.startsWith("/")) {
		let path: string;
		try {
			path = decodeURIComponent(trimmed);
		} catch {
			return null;
		}
		return tildeHomePath(path, homePath);
	}
	try {
		const path = decodeURIComponent(new URL(trimmed).pathname);
		return tildeHomePath(path, homePath);
	} catch {
		return null;
	}
}

/** Shell activity from OSC 6973 payload (`running` / `prompt` → idle). */
export function shellStateFromOsc6973Payload(
	data: string,
): "running" | "idle" | null {
	const t = data.trim();
	if (t === "running") return "running";
	if (t === "prompt") return "idle";
	return null;
}

/** Non-empty trimmed OSC 6974 lifecycle token, or null. Unknown tokens are kept for forward compatibility. */
export function claudeLifecycleFromOsc6974Payload(data: string): string | null {
	const t = data.trim();
	return t.length > 0 ? t : null;
}

/**
 * Window title after stripping Claude’s leading spinner/symbol noise: first letter/digit onward,
 * or from the first emoji if there is no letter/digit (glyph-only session names).
 */
export function stripClaudeWindowTitlePrefix(title: string): string {
	const i = title.search(/[\p{L}\p{N}]/u);
	if (i !== -1) return title.slice(i).trimEnd();

	// Spinners like ✳ are Extended_Pictographic too — use the last pictograph as the session glyph.
	const picts = [...title.matchAll(/\p{Extended_Pictographic}/gu)];
	if (picts.length > 0) {
		const last = picts[picts.length - 1];
		return last[0];
	}
	return "";
}

/** True when the title names the Claude product (English, localized “Claude …”, etc.). */
export function isClaudeProductWindowTitle(name: string): boolean {
	return name === "Claude Code" || name.startsWith("Claude ");
}
