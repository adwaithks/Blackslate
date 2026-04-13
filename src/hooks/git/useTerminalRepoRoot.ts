import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type TerminalRepoRootState = {
	/** `git rev-parse --show-toplevel` for `activeCwd`, or null if not in a repo. `undefined` = still resolving. */
	repoRoot: string | null | undefined;
	/** `true` when the cwd is a linked worktree checkout (not the primary repo folder). `undefined` while resolving. */
	cwdIsLinkedWorktree: boolean | undefined;
};

// While the git panel is open, resolves the checkout root and whether cwd is a linked worktree (for the quick-add button label).
export function useTerminalRepoRoot(
	activeCwd: string,
	open: boolean,
): TerminalRepoRootState {
	const [repoRoot, setRepoRoot] = useState<string | null | undefined>(
		undefined,
	);
	const [cwdIsLinkedWorktree, setCwdIsLinkedWorktree] = useState<
		boolean | undefined
	>(undefined);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setRepoRoot(undefined);
		setCwdIsLinkedWorktree(undefined);
		void Promise.all([
			invoke<string | null>("git_discover_repo_root", {
				cwd: activeCwd,
			}),
			invoke<boolean>("git_cwd_is_linked_worktree", { cwd: activeCwd }),
		]).then(([root, linked]) => {
			if (!cancelled) {
				setRepoRoot(root);
				setCwdIsLinkedWorktree(linked);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [activeCwd, open]);

	return { repoRoot, cwdIsLinkedWorktree };
}
