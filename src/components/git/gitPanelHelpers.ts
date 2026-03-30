import type { GitFile } from "@/components/git/gitTypes";

export const GIT_PANEL_WIDTH_KEY = "git-panel-width";
export const GIT_PANEL_MIN_W = 220;
export const GIT_PANEL_MAX_W = 560;
export const GIT_PANEL_DEFAULT_W = 280;

export function sumLineStats(files: GitFile[]) {
	let add = 0;
	let del = 0;
	for (const f of files) {
		if (f.additions >= 0) add += f.additions;
		if (f.deletions >= 0) del += f.deletions;
	}
	return { add, del };
}

export function repoName(repoPath: string): string {
	return repoPath.split("/").filter(Boolean).pop() ?? repoPath;
}

export function normalizeRepoPath(p: string): string {
	return p.replace(/\/+$/, "") || p;
}

export function isRepoAlreadyTracked(root: string, repos: string[]): boolean {
	const n = normalizeRepoPath(root);
	return repos.some((r) => normalizeRepoPath(r) === n);
}

export function readStoredGitPanelWidth(): number {
	try {
		const v = localStorage.getItem(GIT_PANEL_WIDTH_KEY);
		const n = v ? Number.parseInt(v, 10) : NaN;
		if (Number.isFinite(n)) {
			return Math.min(GIT_PANEL_MAX_W, Math.max(GIT_PANEL_MIN_W, n));
		}
	} catch {
		/* ignore */
	}
	return GIT_PANEL_DEFAULT_W;
}
