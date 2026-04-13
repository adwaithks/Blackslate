// Shared shapes for `get_git_status`, `get_git_worktrees`, and file rows in the git panel.

export type GitFileStatus = "modified" | "added" | "deleted" | "renamed";

export interface GitFile {
	path: string;
	additions: number;
	deletions: number;
	status: GitFileStatus;
}

export interface GitStatus {
	branch: string;
	unstaged: GitFile[];
	staged: GitFile[];
}

export interface GitWorktree {
	path: string;
	/** Branch name, or `(abc1234…)` for detached HEAD. */
	branch: string;
	isMain: boolean;
	isDetached: boolean;
}
