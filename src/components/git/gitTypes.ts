// Shared shapes for `get_git_status` and file rows in the git panel.

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
