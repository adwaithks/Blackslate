// Shared shapes for `get_git_status` and file rows in the git panel.

export interface GitFile {
	path: string;
	additions: number;
	deletions: number;
}

export interface GitStatus {
	branch: string;
	unstaged: GitFile[];
	staged: GitFile[];
}
