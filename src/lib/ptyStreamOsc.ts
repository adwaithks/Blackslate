// Read small pieces of text the shell sends (folder path, busy/idle, Claude status, window title).
// The terminal widget wires these; see registerPtyOscHandlers.

function tildeHomePath(path: string, homePath: string): string {
	const homeNorm = homePath.replace(/\/+$/, "");
	if (!homeNorm) return path;
	if (path === homeNorm) return "~";
	if (path.startsWith(homeNorm + "/")) {
		return "~" + path.slice(homeNorm.length);
	}
	return path;
}

// Turn a path payload from the shell into a short folder string (uses ~ when inside the user home).
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

// Whether the shell says a command is running or the prompt is idle.
export function shellStateFromOsc6973Payload(
	data: string,
): "running" | "idle" | null {
	const t = data.trim();
	if (t === "running") return "running";
	if (t === "prompt") return "idle";
	return null;
}

// Claude lifecycle text from the shell, or null if empty. Unknown words are kept on purpose.
export function claudeLifecycleFromOsc6974Payload(data: string): string | null {
	const t = data.trim();
	return t.length > 0 ? t : null;
}

// Clean up Claude window titles: drop leading decoration, keep the real title text.
export function stripClaudeWindowTitlePrefix(title: string): string {
	const i = title.search(/[\p{L}\p{N}]/u);
	if (i !== -1) return title.slice(i).trimEnd();

	// If there are only symbols, keep the last symbol character as the label.
	const picts = [...title.matchAll(/\p{Extended_Pictographic}/gu)];
	if (picts.length > 0) {
		const last = picts[picts.length - 1];
		return last[0];
	}
	return "";
}

// True when the window title is clearly the Claude app, not a user-named session.
export function isClaudeProductWindowTitle(name: string): boolean {
	return name === "Claude Code" || name.startsWith("Claude ");
}
