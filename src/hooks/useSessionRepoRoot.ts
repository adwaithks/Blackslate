import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * When the git panel is open, resolves whether `activeCwd` sits inside a git
 * repo (for the “Add &lt;folder&gt;” shortcut). `undefined` means still loading.
 */
export function useSessionRepoRoot(
	activeCwd: string,
	open: boolean,
): string | null | undefined {
	const [sessionRepoRoot, setSessionRepoRoot] = useState<
		string | null | undefined
	>(undefined);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setSessionRepoRoot(undefined);
		void invoke<string | null>("git_discover_repo_root", {
			cwd: activeCwd,
		}).then((root) => {
			if (!cancelled) setSessionRepoRoot(root);
		});
		return () => {
			cancelled = true;
		};
	}, [activeCwd, open]);

	return sessionRepoRoot;
}
