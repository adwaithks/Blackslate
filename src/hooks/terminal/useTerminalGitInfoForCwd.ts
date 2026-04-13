import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTerminalStore, selectTerminalCwd, type GitInfo } from "@/store/terminals";

// When this tab’s working directory changes, ask the backend for git details and save them on the terminal row (branch, etc.).
// If the lookup fails, clear git so the sidebar does not show stale data.
export function useTerminalGitInfoForCwd(terminalId: string) {
	const setGit = useTerminalStore((s) => s.setGit);
	const cwd = useTerminalStore((s) => selectTerminalCwd(s, terminalId));

	useEffect(() => {
		void Promise.all([
			invoke<GitInfo | null>("git_info", { cwd }),
			invoke<boolean>("git_cwd_is_linked_worktree", { cwd }),
		])
			.then(([git, linked]) => {
				if (git) setGit(terminalId, { ...git, linkedWorktree: linked });
				else setGit(terminalId, null);
			})
			.catch(() => setGit(terminalId, null));
	}, [cwd, terminalId, setGit]);
}
