import type { Session } from "@/store/sessionsTypes";

/** Display name for a session: the last path segment of cwd, or "~" / "/". */
export function sessionDisplayName(session: Session): string {
	if (session.cwd === "~" || session.cwd === "/") return session.cwd;
	return session.cwd.split("/").filter(Boolean).pop() ?? "~";
}

/**
 * Expand tilde-normalised cwd (as stored from OSC 7) to an absolute path for display.
 * `home` must be the real home directory path (e.g. from `get_home_dir`).
 */
export function cwdToAbsolute(cwd: string, home: string): string {
	const h = home.replace(/\/$/, "");
	if (cwd === "~" || cwd === "") return h;
	if (cwd.startsWith("~/")) return `${h}${cwd.slice(1)}`;
	return cwd;
}
