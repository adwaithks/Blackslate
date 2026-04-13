import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useGitReposStore } from "@/store/gitRepos";
import { useGitPanelResize } from "@/hooks/git/useGitPanelResize";
import { useTerminalRepoRoot } from "@/hooks/git/useTerminalRepoRoot";
import { useTimedFooterMessage } from "@/hooks/git/useTimedFooterMessage";
import {
	repoName,
	isRepoAlreadyTracked,
} from "@/components/git/gitPanelHelpers";
import { GitPanelScrollSkeleton } from "@/components/git/GitPanelSkeletons";
import { GitPanelToolbar } from "@/components/git/GitPanelToolbar";
import { RepoSection } from "@/components/git/RepoSection";

interface GitPanelProps {
	activeCwd: string;
	// When closed we hide it but keep it in the tree so lists and folder checks don't reset.
	open: boolean;
}

// Right strip: repos you track, stage/undo/discard, drag to resize.
export function GitPanel({ activeCwd, open }: GitPanelProps) {
	const { repos, addRepos } = useGitReposStore();
	const [addingFolders, setAddingFolders] = useState(false);
	const [addingCurrent, setAddingCurrent] = useState(false);
	const [footerMsg, setFooterMsg] = useTimedFooterMessage();

	const cwdRepoRoot = useTerminalRepoRoot(activeCwd, open);
	const { panelRef, panelWidth, onResizeMouseDown } = useGitPanelResize();

	const cwdRepoFolderName =
		cwdRepoRoot !== undefined && cwdRepoRoot !== null
			? repoName(cwdRepoRoot)
			: null;

	const showAddCwdRepo =
		cwdRepoRoot !== undefined &&
		cwdRepoRoot !== null &&
		!isRepoAlreadyTracked(cwdRepoRoot, repos);

	const handleAddRepo = useCallback(async () => {
		setAddingFolders(true);
		try {
			const picked = await invoke<string[]>("pick_folders");
			if (picked.length > 0) addRepos(picked);
		} finally {
			setAddingFolders(false);
		}
	}, [addRepos]);

	const handleAddRepoImIn = useCallback(async () => {
		setAddingCurrent(true);
		setFooterMsg(null);
		try {
			const root = await invoke<string | null>("git_discover_repo_root", {
				cwd: activeCwd,
			});
			if (!root) {
				setFooterMsg("Not a git repository");
				return;
			}
			const { repos: list, addRepos: add } = useGitReposStore.getState();
			if (isRepoAlreadyTracked(root, list)) {
				setFooterMsg("Already in list");
				return;
			}
			add([root]);
		} finally {
			setAddingCurrent(false);
		}
	}, [activeCwd, setFooterMsg]);

	return (
		<div
			ref={panelRef}
			style={{ width: open ? panelWidth : 0 }}
			aria-hidden={!open}
			className={cn(
				"relative flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-background overflow-hidden transition-[width] duration-100 ease-out",
			)}
		>
			<div
				onMouseDown={onResizeMouseDown}
				className="absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-foreground/10"
				aria-hidden
			/>
			<GitPanelToolbar
				addingFolders={addingFolders}
				addingCurrent={addingCurrent}
				onAddFolders={handleAddRepo}
				onAddCwdRepo={handleAddRepoImIn}
				cwdRepoRoot={cwdRepoRoot}
				showAddCwdRepo={showAddCwdRepo}
				cwdRepoFolderName={cwdRepoFolderName}
				footerMsg={footerMsg}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
				{repos.length === 0 ? (
					open && cwdRepoRoot === undefined ? (
						<GitPanelScrollSkeleton />
					) : (
						<p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground/40">
							No repositories tracked.
							<br />
							Use Add New above.
						</p>
					)
				) : (
					<div className="flex flex-col gap-2">
						{repos.map((repoPath) => (
							<RepoSection
								key={repoPath}
								repoPath={repoPath}
								panelOpen={open}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
