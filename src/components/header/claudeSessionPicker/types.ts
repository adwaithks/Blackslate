/**
 * Payload from `list_claude_sessions` — mirrors the Rust `ClaudeSessionSummary` struct.
 */
export interface ClaudeSession {
	session_id: string;
	timestamp: string;
	cwd: string;
	git_branch: string | null;
	summary: string;
}
