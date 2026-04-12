import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// While the git panel is open, figures out if your terminal folder is inside a git project (for the quick-add button). undefined = still checking.
export function useTerminalRepoRoot(
	activeCwd: string,
	open: boolean,
): string | null | undefined {
	const [repoRoot, setRepoRoot] = useState<string | null | undefined>(
		undefined,
	);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setRepoRoot(undefined);
		void invoke<string | null>("git_discover_repo_root", {
			cwd: activeCwd,
		}).then((root) => {
			if (!cancelled) setRepoRoot(root);
		});
		return () => {
			cancelled = true;
		};
	}, [activeCwd, open]);

	return repoRoot;
}
