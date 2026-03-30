import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the panel is open but the repo list is still empty (cwd discovery). */
export function GitPanelScrollSkeleton() {
	return (
		<div className="flex flex-col">
			<GitPanelRepoBlockSkeleton />
			<GitPanelRepoBlockSkeleton />
		</div>
	);
}

export function GitPanelRepoBlockSkeleton() {
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

/** Placeholder matching RepoTabs + FileRow layout during `get_git_status`. */
export function RepoSectionInnerSkeleton() {
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
				<Skeleton className={cn("h-3", wide ? "w-[88%]" : "w-[72%]")} />
			</div>
			<div className="flex h-5 w-[52px] shrink-0 items-center justify-end gap-1">
				<Skeleton className="h-3 w-5 rounded-sm" />
				<Skeleton className="h-3 w-5 rounded-sm" />
			</div>
		</div>
	);
}
