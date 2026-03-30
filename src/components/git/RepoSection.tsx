import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { TbChevronDown, TbX } from "react-icons/tb";
import { cn } from "@/lib/utils";
import type { GitStatus } from "@/components/git/gitTypes";
import { sumLineStats, repoName } from "@/components/git/gitPanelHelpers";
import { RepoSectionInnerSkeleton } from "@/components/git/GitPanelSkeletons";
import { RepoTabs } from "@/components/git/RepoTabs";

type StatusState =
	| { kind: "loading" }
	| { kind: "not-git" }
	| { kind: "ready"; status: GitStatus };

interface RepoSectionProps {
	repoPath: string;
	panelOpen: boolean;
	onRemove: () => void;
}

/**
 * One tracked repo: collapsible header + Changes/Staged tabs. Polls `get_git_status`
 * every 3s while the git panel is visible.
 */
export function RepoSection({ repoPath, panelOpen, onRemove }: RepoSectionProps) {
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
