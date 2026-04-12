// One saved assistant session row returned from the app backend.
export interface ClaudeSession {
	session_id: string;
	timestamp: string;
	cwd: string;
	git_branch: string | null;
	summary: string;
}
