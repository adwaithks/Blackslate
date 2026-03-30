/**
 * Bytes to send to the PTY so Claude resumes `sessionId`.
 * Inside an active Claude REPL we use `/resume`; otherwise spawn `claude --resume`.
 */
export function buildResumePtyPayload(
	sessionId: string,
	claudeCodeActive: boolean,
): string {
	return claudeCodeActive
		? `/resume ${sessionId}\r`
		: `claude --resume ${sessionId}\r`;
}
