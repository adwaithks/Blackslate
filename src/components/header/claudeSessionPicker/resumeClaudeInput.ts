// Text to paste into the shell to reopen a session: short command if Claude is already running, full command otherwise.
export function buildResumePtyPayload(
	sessionId: string,
	claudeCodeActive: boolean,
): string {
	return claudeCodeActive
		? `/resume ${sessionId}\r`
		: `claude --resume ${sessionId}\r`;
}
