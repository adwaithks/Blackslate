import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { TbChevronDown, TbX } from "react-icons/tb";
import { cn } from "@/lib/utils";
import { TbFile } from "react-icons/tb";
import type { GitFile, GitFileStatus, GitStatus } from "@/components/git/gitTypes";
import { sumLineStats, repoName } from "@/components/git/gitPanelHelpers";
import { RepoSectionInnerSkeleton } from "@/components/git/GitPanelSkeletons";
import { GitDiffViewerSheet } from "@/components/git/GitDiffViewerSheet";

type StatusState =
	| { kind: "loading" }
	| { kind: "not-git" }
	| { kind: "ready"; status: GitStatus };

interface RepoSectionProps {
	repoPath: string;
	panelOpen: boolean;
	onRemove: () => void;
}

const STATUS_DOT_COLORS: Record<GitFileStatus, [string, string]> = {
	modified: ["border-orange-400/70", "bg-orange-400/70"],
	added:    ["border-green-400/70",  "bg-green-400/70"],
	deleted:  ["border-red-400/70",   "bg-red-400/70"],
	renamed:  ["border-blue-400/70",  "bg-blue-400/70"],
};

function StatusDot({ status }: { status: GitFileStatus }) {
	const [borderCls, dotCls] = STATUS_DOT_COLORS[status] ?? STATUS_DOT_COLORS.modified;
	return (
		<div
			className={cn("size-3 shrink-0 rounded-[2px] border flex items-center justify-center", borderCls)}
			aria-label={status}
		>
			<div className={cn("size-1.5 rounded-full", dotCls)} />
		</div>
	);
}

/**
 * Compact panel row: file-type icon + path + status dot. Clicking opens the diff sheet.
 */
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
			<TbFile className="size-3.5 shrink-0 text-muted-foreground/45" aria-hidden />
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

/**
 * One tracked repo: collapsible header + flat file list. Polling and git actions
 * all live here; changes/staged management is inside the diff sheet.
 */
export function RepoSection({
	repoPath,
	panelOpen,
	onRemove,
}: RepoSectionProps) {
	const [state, setState] = useState<StatusState>({ kind: "loading" });
	const [open, setOpen] = useState(true);
	const [diffOpen, setDiffOpen] = useState(false);
	const [pendingDiffOpen, setPendingDiffOpen] = useState<{
		path: string;
		source: "changes" | "staged";
	} | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastHashRef = useRef<string | null>(null);

	type GitStatusPoll = {
		changed: boolean;
		hash: string;
		status: GitStatus | null;
	};

	const refresh = useCallback(async () => {
		try {
			const polled = await invoke<GitStatusPoll | null>("get_git_status_poll", {
				cwd: repoPath,
				prev_hash: lastHashRef.current,
			});
			if (polled === null) {
				setState({ kind: "not-git" });
			} else {
				lastHashRef.current = polled.hash;
				if (!polled.changed || polled.status === null) return;
				setState({ kind: "ready", status: polled.status });
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

	if (state.kind === "not-git") return null;

	const status = state.kind === "ready" ? state.status : null;
	const lineStats =
		status !== null
			? sumLineStats([...status.unstaged, ...status.staged])
			: { add: 0, del: 0 };

	// Deduplicated flat list for the panel: unstaged files + staged-only files.
	const allFiles: Array<{
		path: string;
		file: GitFile;
		staged: boolean;
		unstaged: boolean;
	}> = useMemo(() => {
		if (!status) return [];
		const map = new Map<
			string,
			{ path: string; file: GitFile; staged: boolean; unstaged: boolean }
		>();
		for (const f of status.unstaged) {
			map.set(f.path, {
				path: f.path,
				file: f,
				staged: false,
				unstaged: true,
			});
		}
		for (const f of status.staged) {
			const prev = map.get(f.path);
			if (prev) {
				map.set(f.path, { ...prev, staged: true });
			} else {
				map.set(f.path, {
					path: f.path,
					file: f,
					staged: true,
					unstaged: false,
				});
			}
		}
		return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
	}, [status]);

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
					) : allFiles.length === 0 ? (
						<p className="px-3 py-3 text-xs text-muted-foreground/35">
							No changes
						</p>
					) : (
						<div className="pt-0.5">
						{allFiles.map((f) => (
							<PanelFileRow
								key={f.path}
								file={f.file}
								onClick={() => {
									setPendingDiffOpen({
										path: f.path,
										source: f.unstaged
											? "changes"
											: "staged",
									});
									setDiffOpen(true);
								}}
							/>
						))}
						</div>
					)}
				</div>
			</CollapsibleContent>

			{status !== null ? (
				<GitDiffViewerSheet
					repoPath={repoPath}
					repoDisplayName={repoName(repoPath)}
					branch={status.branch}
					status={status}
					act={act}
					open={diffOpen}
					onOpenChange={setDiffOpen}
					pendingOpen={pendingDiffOpen}
					onConsumePendingOpen={() => setPendingDiffOpen(null)}
				/>
			) : null}
		</Collapsible>
	);
}
