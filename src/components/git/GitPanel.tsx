import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
	TbChevronDown,
	TbGitBranch,
	TbMinus,
	TbPlus,
	TbX,
} from "react-icons/tb";
import { LuFolderPlus } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useGitReposStore } from "@/store/gitRepos";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitFile {
	path: string;
	additions: number;
	deletions: number;
}

interface GitStatus {
	branch: string;
	unstaged: GitFile[];
	staged: GitFile[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumLineStats(files: GitFile[]) {
	let add = 0;
	let del = 0;
	for (const f of files) {
		if (f.additions >= 0) add += f.additions;
		if (f.deletions >= 0) del += f.deletions;
	}
	return { add, del };
}

function repoName(repoPath: string): string {
	return repoPath.split("/").filter(Boolean).pop() ?? repoPath;
}

function normalizeRepoPath(p: string): string {
	return p.replace(/\/+$/, "") || p;
}

function isRepoAlreadyTracked(root: string, repos: string[]): boolean {
	const n = normalizeRepoPath(root);
	return repos.some((r) => normalizeRepoPath(r) === n);
}

const GIT_PANEL_WIDTH_KEY = "git-panel-width";
const GIT_PANEL_MIN_W = 220;
const GIT_PANEL_MAX_W = 560;
const GIT_PANEL_DEFAULT_W = 280;

function readStoredGitPanelWidth(): number {
	try {
		const v = localStorage.getItem(GIT_PANEL_WIDTH_KEY);
		const n = v ? Number.parseInt(v, 10) : NaN;
		if (Number.isFinite(n)) {
			return Math.min(
				GIT_PANEL_MAX_W,
				Math.max(GIT_PANEL_MIN_W, n),
			);
		}
	} catch {
		/* ignore */
	}
	return GIT_PANEL_DEFAULT_W;
}

/** Full-height placeholder when the panel opens with no repos yet (session cwd still resolving). */
function GitPanelScrollSkeleton() {
	return (
		<div className="flex flex-col">
			<GitPanelRepoBlockSkeleton />
			<GitPanelRepoBlockSkeleton />
		</div>
	);
}

function GitPanelRepoBlockSkeleton() {
	return (
		<div className="border-b border-border/20 pb-2">
			<div className="relative overflow-hidden border border-border/25 bg-muted/35 dark:bg-muted/20">
				<div className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 pr-8">
					<Skeleton className="size-3 shrink-0 rounded-sm" />
					<div className="flex min-w-0 flex-1 items-center gap-1">
						<Skeleton className="h-3.5 w-[32%] max-w-[120px]" />
						<span className="text-muted-foreground/30" aria-hidden>
							·
						</span>
						<Skeleton className="h-3 w-20 max-w-[40%] shrink-0 rounded-sm" />
					</div>
					<Skeleton className="h-3 w-10 shrink-0 rounded-sm" />
				</div>
			</div>
			<RepoSectionInnerSkeleton />
		</div>
	);
}

/** Mirrors `RepoTabs` + stacked `FileRow`s while `get_git_status` is in flight. */
function RepoSectionInnerSkeleton() {
	return (
		<div className="min-h-0">
			<div className="flex shrink-0 items-center border-b border-border/20 min-w-0">
				<div className="flex h-7 min-h-7 flex-1 min-w-0 items-center gap-2 px-2">
					<Skeleton className="h-5 w-18 rounded-sm" />
					<Skeleton className="h-5 w-14 rounded-sm" />
				</div>
				<div className="flex h-7 w-[50px] shrink-0 items-center justify-end gap-0.5 pr-2 pl-1">
					<Skeleton className="size-6 shrink-0 rounded-sm" />
					<Skeleton className="size-6 shrink-0 rounded-sm" />
				</div>
			</div>
			<div className="pt-0.5">
				<FileRowSkeleton />
				<FileRowSkeleton wide />
				<FileRowSkeleton />
			</div>
		</div>
	);
}

function FileRowSkeleton({ wide }: { wide?: boolean }) {
	return (
		<div className="flex min-w-0 items-center gap-2 px-2 py-1">
			<div className="min-w-0 flex-1 overflow-hidden">
				<Skeleton
					className={cn("h-3", wide ? "w-[88%]" : "w-[72%]")}
				/>
			</div>
			<div className="flex h-5 w-[52px] shrink-0 items-center justify-end gap-1">
				<Skeleton className="h-3 w-5 rounded-sm" />
				<Skeleton className="h-3 w-5 rounded-sm" />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Top-level panel
// ---------------------------------------------------------------------------

interface GitPanelProps {
	/** Absolute cwd of the active session (for “Add repo I’m in”). */
	activeCwd: string;
	/** When false, panel is `display:none` but stays mounted (state & PTY-adjacent work preserved). */
	open: boolean;
}

export function GitPanel({ activeCwd, open }: GitPanelProps) {
	const { repos, addRepos, removeRepo } = useGitReposStore();
	const [addingFolders, setAddingFolders] = useState(false);
	const [addingCurrent, setAddingCurrent] = useState(false);
	const [footerMsg, setFooterMsg] = useState<string | null>(null);
	/** Git root for `activeCwd` — basename shown on the session Add button. */
	const [sessionRepoRoot, setSessionRepoRoot] = useState<string | null | undefined>(
		undefined,
	);
	const [panelWidth, setPanelWidth] = useState(readStoredGitPanelWidth);
	const panelRef = useRef<HTMLDivElement>(null);
	const dragState = useRef<{ startX: number; startWidth: number } | null>(
		null,
	);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragState.current) return;
			const delta = dragState.current.startX - e.clientX;
			const reserveMain = 200;
			const maxW = Math.min(
				GIT_PANEL_MAX_W,
				Math.max(GIT_PANEL_MIN_W, window.innerWidth - reserveMain),
			);
			const w = Math.max(
				GIT_PANEL_MIN_W,
				Math.min(maxW, dragState.current.startWidth + delta),
			);
			const el = panelRef.current;
			if (el) el.style.width = `${w}px`;
		};
		const onUp = () => {
			if (!dragState.current) return;
			dragState.current = null;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			const el = panelRef.current;
			if (el) {
				const w = Math.round(el.getBoundingClientRect().width);
				setPanelWidth(w);
				try {
					localStorage.setItem(GIT_PANEL_WIDTH_KEY, String(w));
				} catch {
					/* ignore */
				}
			}
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setSessionRepoRoot(undefined);
		void invoke<string | null>("git_discover_repo_root", { cwd: activeCwd }).then(
			(root) => {
				if (!cancelled) setSessionRepoRoot(root);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [activeCwd, open]);

	const sessionRootFolderName =
		sessionRepoRoot !== undefined && sessionRepoRoot !== null
			? repoName(sessionRepoRoot)
			: null;

	const showAddSessionRepo =
		sessionRepoRoot !== undefined &&
		sessionRepoRoot !== null &&
		!isRepoAlreadyTracked(sessionRepoRoot, repos);

	useEffect(() => {
		if (!footerMsg) return;
		const t = window.setTimeout(() => setFooterMsg(null), 2800);
		return () => clearTimeout(t);
	}, [footerMsg]);

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
	}, [activeCwd]);

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
				onMouseDown={(e) => {
					const el = panelRef.current;
					const startWidth = el
						? Math.round(el.getBoundingClientRect().width)
						: panelWidth;
					dragState.current = {
						startX: e.clientX,
						startWidth,
					};
					document.body.style.cursor = "col-resize";
					document.body.style.userSelect = "none";
					e.preventDefault();
				}}
				className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-white/15"
				aria-hidden
			/>
			<header className="shrink-0 border-b border-border/20 bg-muted/15 px-1.5 py-1 dark:bg-muted/10">
				<div className="flex min-w-0 gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleAddRepo}
						disabled={addingFolders || addingCurrent}
						title="Pick folders to track"
						className={cn(
							"h-6 min-h-6 justify-center gap-1 px-1 py-0 text-[11px] leading-none text-muted-foreground hover:text-foreground",
							showAddSessionRepo
								? "min-w-0 flex-1"
								: "w-full",
						)}
					>
						<LuFolderPlus className="size-3 shrink-0" />
						<span className="min-w-0 truncate">Add New</span>
					</Button>
					{sessionRepoRoot !== undefined && showAddSessionRepo ? (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleAddRepoImIn}
							disabled={addingFolders || addingCurrent}
							title={sessionRepoRoot ?? undefined}
							className="h-6 min-h-6 min-w-0 flex-1 justify-center gap-1 px-1 py-0 text-[11px] leading-none text-muted-foreground hover:text-foreground"
						>
							<TbGitBranch className="size-3 shrink-0" />
							<span className="min-w-0 truncate">
								Add {sessionRootFolderName}
							</span>
						</Button>
					) : null}
				</div>
				{footerMsg ? (
					<p className="mt-0.5 px-0.5 text-center text-[10px] leading-tight text-muted-foreground/65">
						{footerMsg}
					</p>
				) : null}
			</header>

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

// ---------------------------------------------------------------------------
// Per-repo collapsible section
// ---------------------------------------------------------------------------

type StatusState =
	| { kind: "loading" }
	| { kind: "not-git" }
	| { kind: "ready"; status: GitStatus };

interface RepoSectionProps {
	repoPath: string;
	panelOpen: boolean;
	onRemove: () => void;
}

function RepoSection({ repoPath, panelOpen, onRemove }: RepoSectionProps) {
	const [state, setState] = useState<StatusState>({ kind: "loading" });
	const [open, setOpen] = useState(true);
	const [activeTab, setActiveTab] = useState<"changes" | "staged">("changes");
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const refresh = useCallback(async () => {
		try {
			const result = await invoke<GitStatus | null>("get_git_status", {
				cwd: repoPath,
			});
			if (result === null) {
				setState({ kind: "not-git" });
			} else {
				setState({ kind: "ready", status: result });
			}
		} catch {
			setState({ kind: "not-git" });
		}
	}, [repoPath]);

	useEffect(() => {
		if (!panelOpen) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}
		void refresh();
		intervalRef.current = setInterval(refresh, 3000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
			intervalRef.current = null;
		};
	}, [panelOpen, refresh]);

	const act = useCallback(
		async (cmd: string, args?: Record<string, string>) => {
			await invoke(cmd, { cwd: repoPath, ...args });
			await refresh();
		},
		[repoPath, refresh],
	);

	// Not a valid git repo → don't render
	if (state.kind === "not-git") return null;

	const status = state.kind === "ready" ? state.status : null;
	const lineStats =
		status !== null
			? sumLineStats([...status.unstaged, ...status.staged])
			: { add: 0, del: 0 };

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="border-b pb-2 border-border/20"
		>
			<div className="group/header relative">
				<div className="relative overflow-hidden border border-border/25 bg-muted/35 dark:bg-muted/20">
					<CollapsibleTrigger className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 pr-8 text-left transition-colors hover:bg-muted/50 dark:hover:bg-muted/30">
						<TbChevronDown
							className={cn(
								"size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150",
								open ? "rotate-0" : "-rotate-90",
							)}
							aria-hidden
						/>
						<span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
							<span className="shrink-0 truncate text-xs font-medium text-foreground/85">
								{repoName(repoPath)}
							</span>
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
						</span>
						{status !== null &&
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
							onRemove();
						}}
						title="Remove repository"
						className="absolute right-1 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted/50 hover:text-foreground group-hover/header:opacity-100 dark:hover:bg-muted/40"
					>
						<TbX className="size-3" aria-hidden />
					</button>
				</div>
			</div>

			<CollapsibleContent>
				<div className="min-h-0">
					{state.kind === "loading" ? (
						<RepoSectionInnerSkeleton />
					) : (
						<RepoTabs
							status={status!}
							activeTab={activeTab}
							onTabChange={setActiveTab}
							act={act}
						/>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

// ---------------------------------------------------------------------------
// Tabs + file lists for one repo
// ---------------------------------------------------------------------------

interface RepoTabsProps {
	status: GitStatus;
	activeTab: "changes" | "staged";
	onTabChange: (t: "changes" | "staged") => void;
	act: (cmd: string, args?: Record<string, string>) => Promise<void>;
}

function RepoTabs({ status, activeTab, onTabChange, act }: RepoTabsProps) {
	const totalUnstaged = status.unstaged.length;
	const totalStaged = status.staged.length;

	const showStageAll = activeTab === "changes" && totalUnstaged > 0;
	const showDiscardAll = activeTab === "changes" && totalUnstaged > 0;
	const showUnstageAll = activeTab === "staged" && totalStaged > 0;

	return (
		<Tabs
			value={activeTab}
			onValueChange={(v) => onTabChange(v as "changes" | "staged")}
			className="flex flex-col min-h-0"
		>
			{/* Tabs + bulk actions: fixed-width action rail avoids layout shift on tab change */}
			<div className="flex shrink-0 items-center border-b border-border/20 min-w-0">
				<TabsList
					variant="line"
					className="h-7 min-h-7 flex-1 min-w-0 rounded-none bg-transparent border-0 px-2 justify-start gap-0"
				>
					<TabsTrigger
						value="changes"
						className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
					>
						Changes
						{totalUnstaged > 0 && (
							<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
								{totalUnstaged}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger
						value="staged"
						className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
					>
						Staged
						{totalStaged > 0 && (
							<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
								{totalStaged}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				<div className="flex h-7 shrink-0 items-center justify-end gap-0.5 pr-2 pl-1">
					<div className="flex w-[50px] shrink-0 items-center justify-end gap-0.5">
						<div className="flex size-6 shrink-0 items-center justify-center">
							{showStageAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("stage_all")}
									className="size-6 p-0 text-muted-foreground hover:text-foreground"
									title="Stage all changes"
								>
									<TbPlus className="size-3.5" />
								</Button>
							) : null}
						</div>
						<div className="flex size-6 shrink-0 items-center justify-center">
							{showDiscardAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("discard_all")}
									className="size-6 p-0 text-muted-foreground hover:text-destructive"
									title="Discard all unstaged changes"
								>
									<TbMinus className="size-3.5" />
								</Button>
							) : showUnstageAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("unstage_all")}
									className="size-6 p-0 text-muted-foreground hover:text-foreground"
									title="Unstage all files"
								>
									<TbMinus className="size-3.5" />
								</Button>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<TabsContent value="changes" className="mt-0">
				{status.unstaged.length === 0 ? (
					<p className="px-3 py-3 text-xs text-muted-foreground/35">
						No unstaged changes
					</p>
				) : (
					status.unstaged.map((f) => (
						<FileRow
							key={f.path}
							file={f}
							actions={[
								{
									icon: <TbPlus className="size-3.5" />,
									label: "Stage file",
									onClick: () =>
										act("stage_file", { path: f.path }),
								},
								{
									icon: <TbMinus className="size-3.5" />,
									label: "Discard changes",
									danger: true,
									onClick: () =>
										act("discard_file", { path: f.path }),
								},
							]}
						/>
					))
				)}
			</TabsContent>

			<TabsContent value="staged" className="mt-0">
				{status.staged.length === 0 ? (
					<p className="px-3 py-3 text-xs text-muted-foreground/35">
						No staged changes
					</p>
				) : (
					status.staged.map((f) => (
						<FileRow
							key={f.path}
							file={f}
							actions={[
								{
									icon: <TbMinus className="size-3.5" />,
									label: "Unstage file",
									onClick: () =>
										act("unstage_file", { path: f.path }),
								},
							]}
						/>
					))
				)}
			</TabsContent>
		</Tabs>
	);
}

// ---------------------------------------------------------------------------
// File row
// ---------------------------------------------------------------------------

interface FileAction {
	icon: React.ReactNode;
	label: string;
	danger?: boolean;
	onClick: () => void;
}

function FileRow({ file, actions }: { file: GitFile; actions: FileAction[] }) {
	const segments = file.path.split("/");
	const filename = segments.pop() ?? file.path;
	const dir = segments.length > 0 ? `${segments.join("/")}/` : "";
	const binary = file.additions < 0 || file.deletions < 0;

	return (
		<div className="group flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted/20">
			<div className="min-w-0 flex-1 flex justify-start overflow-hidden">
				<div
					className="flex min-w-0 flex-1 items-baseline gap-0.5 overflow-hidden text-left"
					title={file.path}
				>
					{dir ? (
						<span
							className="min-w-0 shrink overflow-hidden text-[11px] leading-tight text-muted-foreground/55"
							dir="rtl"
						>
							<span
								dir="ltr"
								className="block truncate text-left"
							>
								{dir}
							</span>
						</span>
					) : null}
					<span
						className={cn(
							"text-xs leading-tight text-foreground/85 min-w-0 text-left",
							dir ? "shrink-0" : "min-w-0 flex-1 truncate",
						)}
					>
						{filename}
					</span>
				</div>
			</div>

			<div className="relative flex h-5 w-[52px] shrink-0 items-center justify-end">
				{/* Default: line stats */}
				<div
					className={cn(
						"flex items-center justify-end gap-1 text-[11px] tabular-nums transition-opacity duration-100",
						"group-hover:pointer-events-none group-hover:opacity-0",
					)}
				>
					{binary ? (
						<span className="text-[10px] text-muted-foreground/40">
							bin
						</span>
					) : (
						<>
							<span
								className={
									file.additions > 0
										? "text-green-500/75"
										: "text-muted-foreground/30"
								}
							>
								+{file.additions}
							</span>
							<span
								className={
									file.deletions > 0
										? "text-red-500/75"
										: "text-muted-foreground/30"
								}
							>
								−{file.deletions}
							</span>
						</>
					)}
				</div>
				{/* Hover: action buttons */}
				<div
					className={cn(
						"absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-100",
						"group-hover:opacity-100",
					)}
				>
					{actions.map((a) => (
						<Button
							key={a.label}
							variant="ghost"
							size="sm"
							onClick={a.onClick}
							title={a.label}
							className={cn(
								"h-5 w-5 p-0",
								a.danger
									? "text-muted-foreground hover:text-destructive"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{a.icon}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}
