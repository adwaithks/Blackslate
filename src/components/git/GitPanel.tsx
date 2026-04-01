import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useGitReposStore } from "@/store/gitRepos";
import { useGitPanelResize } from "@/hooks/useGitPanelResize";
import { useSessionRepoRoot } from "@/hooks/useSessionRepoRoot";
import { useTimedFooterMessage } from "@/hooks/useTimedFooterMessage";
import {
	repoName,
	isRepoAlreadyTracked,
} from "@/components/git/gitPanelHelpers";
import { GitPanelScrollSkeleton } from "@/components/git/GitPanelSkeletons";
import { GitPanelToolbar } from "@/components/git/GitPanelToolbar";
import { RepoSection } from "@/components/git/RepoSection";

interface GitPanelProps {
	activeCwd: string;
	/** Panel stays mounted when false (`display:none`) so list state and discovery effects survive toggles. */
	open: boolean;
}

/**
 * Right-hand git status panel: tracked repos, stage/discard/unstage, resize handle.
 */
export function GitPanel({ activeCwd, open }: GitPanelProps) {
	const { repos, addRepos, removeRepo } = useGitReposStore();
	const [addingFolders, setAddingFolders] = useState(false);
	const [addingCurrent, setAddingCurrent] = useState(false);
	const [footerMsg, setFooterMsg] = useTimedFooterMessage();

	const sessionRepoRoot = useSessionRepoRoot(activeCwd, open);
	const { panelRef, panelWidth, onResizeMouseDown } = useGitPanelResize();

	const sessionRootFolderName =
		sessionRepoRoot !== undefined && sessionRepoRoot !== null
			? repoName(sessionRepoRoot)
			: null;

	const showAddSessionRepo =
		sessionRepoRoot !== undefined &&
		sessionRepoRoot !== null &&
		!isRepoAlreadyTracked(sessionRepoRoot, repos);

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
			style={{ width: panelWidth }}
			aria-hidden={!open}
			className={cn(
				"relative flex h-full min-h-0 shrink-0 flex-col border-l border-border/40 bg-background",
				!open && "hidden",
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
				onAddSessionRepo={handleAddRepoImIn}
				sessionRepoRoot={sessionRepoRoot}
				showAddSessionRepo={showAddSessionRepo}
				sessionRootFolderName={sessionRootFolderName}
				footerMsg={footerMsg}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{repos.length === 0 ? (
					open && sessionRepoRoot === undefined ? (
						<GitPanelScrollSkeleton />
					) : (
						<p className="px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground/40">
							No repositories tracked.
							<br />
							Use Add New above.
						</p>
					)
				) : (
					repos.map((repoPath) => (
						<RepoSection
							key={repoPath}
							repoPath={repoPath}
							panelOpen={open}
							onRemove={() => removeRepo(repoPath)}
						/>
					))
				)}
			</div>
		</div>
	);
}
