// One fold-open block per repo. While the panel is open we recheck status every few seconds.
// Changed and staged files are merged into one list (same file can be both). Click a row to diff and stage/unstage.
// When a repo has multiple worktrees each one gets its own nested collapsible.

import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { TbChevronDown, TbFile, TbX } from "react-icons/tb";
import { cn } from "@/lib/utils";
import type { GitFile, GitFileStatus, GitStatus, GitWorktree } from "@/components/git/gitTypes";
import { sumLineStats, repoName } from "@/components/git/gitPanelHelpers";
import { RepoSectionInnerSkeleton } from "@/components/git/GitPanelSkeletons";
import { GitDiffViewerSheet } from "@/components/git/GitDiffViewerSheet";
import { useGitReposStore } from "@/store/gitRepos";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoSectionProps {
	repoPath: string;
	panelOpen: boolean;
}

// Loading, not a git folder, or we have a full status snapshot.
type RepoStatusState =
	| { kind: "loading" }
	| { kind: "not-git" }
	| { kind: "ready"; status: GitStatus };

// Latest poll from the app backend; includes a short fingerprint so we can skip redraws when nothing changed.
type GitStatusPollResult = {
	changed: boolean;
	hash: string;
	status: GitStatus | null;
};

// One line in the list: file plus whether it's waiting to commit, changed on disk, or both.
type MergedPanelFile = {
	path: string;
	file: GitFile;
	staged: boolean;
	unstaged: boolean;
};

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<GitFileStatus, [string, string]> = {
	modified: ["border-orange-400/70", "bg-orange-400/70"],
	added: ["border-green-400/70", "bg-green-400/70"],
	deleted: ["border-red-400/70", "bg-red-400/70"],
	renamed: ["border-blue-400/70", "bg-blue-400/70"],
};

function StatusDot({ status }: { status: GitFileStatus }) {
	const [borderCls, dotCls] =
		STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.modified;
	return (
		<div
			className={cn(
				"size-3 shrink-0 rounded-[2px] border flex items-center justify-center",
				borderCls,
			)}
			aria-label={status}
		>
			<div className={cn("size-1.5 rounded-full", dotCls)} />
		</div>
	);
}

// One line: icon, path (folder + filename), status color. Click opens the diff sheet.
function PanelFileRow({
	file,
	onClick,
}: {
	file: GitFile;
	onClick: () => void;
}) {
	const segments = file.path.split("/");
	const filename = segments.pop() ?? file.path;
	const dir = segments.length > 0 ? `${segments.join("/")}/` : "";
	const deleted = file.status === "deleted";

	return (
		<button
			type="button"
			onClick={onClick}
			title={file.path}
			className="flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-left hover:bg-muted/20"
		>
			<TbFile
				className="size-3.5 shrink-0 text-muted-foreground/45"
				aria-hidden
			/>
			<div className="flex min-w-0 flex-1 items-baseline gap-0.5 overflow-hidden">
				{dir ? (
					<span
						className={cn(
							"min-w-0 shrink overflow-hidden text-[11px] leading-tight text-muted-foreground/55",
							deleted && "line-through opacity-60",
						)}
						dir="rtl"
					>
						<span dir="ltr" className="block truncate text-left">
							{dir}
						</span>
					</span>
				) : null}
				<span
					className={cn(
						"text-xs leading-tight text-foreground/85 min-w-0 text-left",
						dir ? "shrink-0" : "min-w-0 flex-1 truncate",
						deleted && "line-through opacity-60",
					)}
				>
					{filename}
				</span>
			</div>
			<StatusDot status={file.status} />
		</button>
	);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Git has two lists (staged vs not). We show one list; if a path is in both, one row shows both states.
function mergeUnstagedAndStagedForPanel(status: GitStatus): MergedPanelFile[] {
	const byPath = new Map<string, MergedPanelFile>();

	for (const file of status.unstaged) {
		byPath.set(file.path, {
			path: file.path,
			file,
			staged: false,
			unstaged: true,
		});
	}

	for (const file of status.staged) {
		const existing = byPath.get(file.path);
		if (existing) {
			byPath.set(file.path, { ...existing, staged: true });
		} else {
			byPath.set(file.path, {
				path: file.path,
				file,
				staged: true,
				unstaged: false,
			});
		}
	}

	return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// Hook: load + poll git status while the panel is open
// ---------------------------------------------------------------------------

function useRepoGitStatus(repoPath: string, panelOpen: boolean) {
	const [state, setState] = useState<RepoStatusState>({ kind: "loading" });
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastStatusHashRef = useRef<string | null>(null);

	const refresh = useCallback(async (opts?: { force?: boolean }) => {
		try {
			const polled = await invoke<GitStatusPollResult | null>(
				"get_git_status_poll",
				{
					cwd: repoPath,
					// After stage/unstage/discard, always re-fetch: the poll hash can
					// occasionally match the previous snapshot even though git changed
					// (e.g. racing polls), which would leave the sheet lists stale.
					prevHash: opts?.force ? null : lastStatusHashRef.current,
				},
			);

			if (polled === null) {
				setState({ kind: "not-git" });
				return;
			}

			lastStatusHashRef.current = polled.hash;

			// Backend says "same as last time" — skip updating React state.
			if (!polled.changed || polled.status === null) return;

			setState({ kind: "ready", status: polled.status });
		} catch {
			setState({ kind: "not-git" });
		}
	}, [repoPath]);

	useEffect(() => {
		if (!panelOpen) {
			if (pollTimerRef.current) {
				clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
			}
			return;
		}

		void refresh();
		pollTimerRef.current = setInterval(refresh, 3000);

		return () => {
			if (pollTimerRef.current) clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		};
	}, [panelOpen, refresh]);

	return { state, refresh };
}

// ---------------------------------------------------------------------------
// Hook: fetch worktrees for a repo, re-poll at a slow cadence
// ---------------------------------------------------------------------------

function useGitWorktrees(repoPath: string, panelOpen: boolean): GitWorktree[] | null {
	const [worktrees, setWorktrees] = useState<GitWorktree[] | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetch = useCallback(async () => {
		const wts = await invoke<GitWorktree[]>("get_git_worktrees", { repoPath });
		setWorktrees(wts);
	}, [repoPath]);

	useEffect(() => {
		if (!panelOpen) {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			return;
		}

		void fetch();
		timerRef.current = setInterval(fetch, 15_000);

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			timerRef.current = null;
		};
	}, [panelOpen, fetch]);

	return worktrees;
}

// ---------------------------------------------------------------------------
// WorktreeSubsection — one nested collapsible for a single worktree
// ---------------------------------------------------------------------------

function WorktreeSubsection({
	worktree,
	panelOpen,
}: {
	worktree: GitWorktree;
	panelOpen: boolean;
}) {
	const { state, refresh } = useRepoGitStatus(worktree.path, panelOpen);
	const [expanded, setExpanded] = useState(true);
	const [diffSheetOpen, setDiffSheetOpen] = useState(false);
	const [fileToOpenInDiff, setFileToOpenInDiff] = useState<{
		path: string;
		source: "changes" | "staged";
	} | null>(null);

	const runGitCommandThenRefresh = useCallback(
		async (command: string, args?: Record<string, string>) => {
			await invoke(command, { cwd: worktree.path, ...args });
			await refresh({ force: true });
		},
		[worktree.path, refresh],
	);

	const status = state.kind === "ready" ? state.status : null;

	const lineStats = useMemo(() => {
		if (!status) return { add: 0, del: 0 };
		return sumLineStats([...status.unstaged, ...status.staged]);
	}, [status]);

	const mergedFiles = useMemo(
		() => (status ? mergeUnstagedAndStagedForPanel(status) : []),
		[status],
	);

	function openDiffForFile(entry: MergedPanelFile) {
		setFileToOpenInDiff({
			path: entry.path,
			source: entry.unstaged ? "changes" : "staged",
		});
		setDiffSheetOpen(true);
	}

	if (state.kind === "not-git") return null;

	return (
		<>
			<Collapsible open={expanded} onOpenChange={setExpanded}>
				<CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 px-3 py-1 text-left transition-colors hover:bg-muted/20">
					<TbChevronDown
						className={cn(
							"size-3 shrink-0 text-muted-foreground/40 transition-transform duration-150",
							expanded ? "rotate-0" : "-rotate-90",
						)}
						aria-hidden
					/>
					<span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
						{state.kind === "loading" ? (
							<Skeleton className="h-3 w-28 max-w-[55%] rounded-sm" />
						) : (
							<span
								className="min-w-0 truncate text-xs text-foreground/75"
								title={worktree.branch}
							>
								{worktree.branch}
							</span>
						)}
					</span>
					{status !== null && (lineStats.add > 0 || lineStats.del > 0) && (
						<span className="shrink-0 text-[11px] tabular-nums opacity-70">
							<span className="text-green-500/80">+{lineStats.add}</span>
							<span className="mx-0.5 text-muted-foreground/30"> </span>
							<span className="text-red-500/80">−{lineStats.del}</span>
						</span>
					)}
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="min-h-0">
						{state.kind === "loading" ? (
							<RepoSectionInnerSkeleton />
						) : mergedFiles.length === 0 ? (
							<p className="px-3 py-2 text-xs text-muted-foreground/35">
								No changes
							</p>
						) : (
							<div className="pt-0.5">
								{mergedFiles.map((entry) => (
									<PanelFileRow
										key={entry.path}
										file={entry.file}
										onClick={() => openDiffForFile(entry)}
									/>
								))}
							</div>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>

			{status !== null ? (
				<GitDiffViewerSheet
					repoPath={worktree.path}
					repoDisplayName={repoName(worktree.path)}
					branch={status.branch}
					status={status}
					act={runGitCommandThenRefresh}
					open={diffSheetOpen}
					onOpenChange={setDiffSheetOpen}
					pendingOpen={fileToOpenInDiff}
					onConsumePendingOpen={() => setFileToOpenInDiff(null)}
				/>
			) : null}
		</>
	);
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

function RepoSectionImpl({ repoPath, panelOpen }: RepoSectionProps) {
	const removeRepo = useGitReposStore((s) => s.removeRepo);

	const worktrees = useGitWorktrees(repoPath, panelOpen);
	const isMultiWorktree = worktrees !== null && worktrees.length > 1;

	// Only active in single-worktree mode; disabled once worktrees load and there are multiple.
	const { state, refresh } = useRepoGitStatus(repoPath, panelOpen && !isMultiWorktree);

	const [sectionExpanded, setSectionExpanded] = useState(true);
	const [diffSheetOpen, setDiffSheetOpen] = useState(false);
	const [fileToOpenInDiff, setFileToOpenInDiff] = useState<{
		path: string;
		source: "changes" | "staged";
	} | null>(null);

	// Run a Tauri git command, then refresh the lists (stage, discard, etc.).
	const runGitCommandThenRefresh = useCallback(
		async (command: string, args?: Record<string, string>) => {
			await invoke(command, { cwd: repoPath, ...args });
			await refresh({ force: true });
		},
		[repoPath, refresh],
	);

	const status = state.kind === "ready" ? state.status : null;

	const lineStats = useMemo(() => {
		if (!status) return { add: 0, del: 0 };
		return sumLineStats([...status.unstaged, ...status.staged]);
	}, [status]);

	const mergedFiles = useMemo(
		() => (status ? mergeUnstagedAndStagedForPanel(status) : []),
		[status],
	);

	// In single-worktree mode we return null when git says this isn't a repo.
	// In multi-worktree mode this state never updates (polling is off), so we
	// don't gate on it — each WorktreeSubsection handles its own not-git check.
	if (!isMultiWorktree && state.kind === "not-git") return null;

	function openDiffForFile(entry: MergedPanelFile) {
		setFileToOpenInDiff({
			path: entry.path,
			source: entry.unstaged ? "changes" : "staged",
		});
		setDiffSheetOpen(true);
	}

	return (
		<Collapsible
			open={sectionExpanded}
			onOpenChange={setSectionExpanded}
			className="overflow-hidden rounded-md bg-muted/25 ring-1 ring-border/50"
		>
			<div className="group/header relative">
				<div
					className={cn(
						"relative overflow-hidden border-b border-border/50 bg-muted/40",
					)}
				>
					<CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 pr-8 text-left transition-colors hover:bg-muted/30">
						<TbChevronDown
							className={cn(
								"size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150",
								sectionExpanded ? "rotate-0" : "-rotate-90",
							)}
							aria-hidden
						/>
						<span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
							<span className="shrink-0 truncate text-xs font-medium text-foreground/85">
								{repoName(repoPath)}
							</span>
							{/* In single-worktree mode show the branch in the repo header (same as before).
							    In multi-worktree mode the branch lives in each sub-section header. */}
							{!isMultiWorktree && (
								<>
									<span
										className="shrink-0 text-muted-foreground/45"
										aria-hidden
									>
										·
									</span>
									{state.kind === "loading" ? (
										<Skeleton className="h-3 w-24 max-w-[45%] min-w-0 shrink rounded-sm" />
									) : (
										<span
											className="min-w-0 truncate text-xs text-muted-foreground/70"
											title={status?.branch}
										>
											{status?.branch ?? ""}
										</span>
									)}
								</>
							)}
						</span>
						{!isMultiWorktree &&
							status !== null &&
							(lineStats.add > 0 || lineStats.del > 0) && (
								<span className="shrink-0 text-[11px] tabular-nums opacity-70 transition-opacity group-hover/header:opacity-0">
									<span className="text-green-500/80">
										+{lineStats.add}
									</span>
									<span className="mx-0.5 text-muted-foreground/30">
										{" "}
									</span>
									<span className="text-red-500/80">
										−{lineStats.del}
									</span>
								</span>
							)}
					</CollapsibleTrigger>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							removeRepo(repoPath);
						}}
						title="Remove repository"
						className="absolute right-1 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted/40 hover:text-foreground group-hover/header:opacity-100"
					>
						<TbX className="size-3" aria-hidden />
					</button>
				</div>
			</div>

			<CollapsibleContent>
				{isMultiWorktree ? (
					// Multi-worktree: one nested collapsible per worktree.
					<div className="min-h-0 divide-y divide-border/50">
						{worktrees.map((wt) => (
							<WorktreeSubsection
								key={wt.path}
								worktree={wt}
								panelOpen={panelOpen}
							/>
						))}
					</div>
				) : (
					// Single-worktree: same file list as before.
					<div className="min-h-0">
						{state.kind === "loading" ? (
							<RepoSectionInnerSkeleton />
						) : mergedFiles.length === 0 ? (
							<p className="px-3 py-3 text-xs text-muted-foreground/35">
								No changes
							</p>
						) : (
							<div className="pt-0.5">
								{mergedFiles.map((entry) => (
									<PanelFileRow
										key={entry.path}
										file={entry.file}
										onClick={() => openDiffForFile(entry)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</CollapsibleContent>

			{!isMultiWorktree && status !== null ? (
				<GitDiffViewerSheet
					repoPath={repoPath}
					repoDisplayName={repoName(repoPath)}
					branch={status.branch}
					status={status}
					act={runGitCommandThenRefresh}
					open={diffSheetOpen}
					onOpenChange={setDiffSheetOpen}
					pendingOpen={fileToOpenInDiff}
					onConsumePendingOpen={() => setFileToOpenInDiff(null)}
				/>
			) : null}
		</Collapsible>
	);
}

export const RepoSection = memo(RepoSectionImpl);
