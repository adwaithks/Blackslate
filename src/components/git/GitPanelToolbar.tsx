import { Button } from "@/components/ui/button";
import { lineTabsStripMinHeightClass } from "@/components/ui/tabs";
import { LuFolderPlus, LuFolderTree } from "react-icons/lu";
import { TbGitBranch } from "react-icons/tb";
import { cn } from "@/lib/utils";

interface GitPanelToolbarProps {
	addingFolders: boolean;
	addingCurrent: boolean;
	onAddFolders: () => void;
	onAddCwdRepo: () => void;
	// null = not in a repo; undefined = still checking the current folder
	cwdRepoRoot: string | null | undefined;
	showAddCwdRepo: boolean;
	cwdRepoFolderName: string | null;
	/** When true, quick-add targets a linked worktree path (wording only). */
	cwdIsLinkedWorktree: boolean | undefined;
	footerMsg: string | null;
}

// Compact toolbar buttons; cwd-repo label truncates with max-width on that row only.
const BTN_ROW =
	"h-6 min-h-6 w-auto shrink-0 justify-center gap-1 px-1.5 py-0 text-[11px] leading-none text-muted-foreground hover:text-foreground";

// Top bar: add the folder your terminal is in (if it's a repo), or pick folders to watch.
export function GitPanelToolbar({
	addingFolders,
	addingCurrent,
	onAddFolders,
	onAddCwdRepo,
	cwdRepoRoot,
	showAddCwdRepo,
	cwdRepoFolderName,
	cwdIsLinkedWorktree,
	footerMsg,
}: GitPanelToolbarProps) {
	const disabled = addingFolders || addingCurrent;

	return (
		<header className="shrink-0 bg-background h-10 px-1.5 py-1">
			<div
				className={cn(
					"flex min-w-0 flex-wrap items-center justify-end gap-1",
					lineTabsStripMinHeightClass,
				)}
			>
				{cwdRepoRoot !== undefined && showAddCwdRepo ? (
					<Button
						variant="ghost"
						size="xs"
						onClick={onAddCwdRepo}
						disabled={disabled}
						title={
							cwdIsLinkedWorktree
								? `Add this worktree to the panel (${cwdRepoRoot ?? ""})`
								: (cwdRepoRoot ?? undefined)
						}
						className={cn(BTN_ROW, "max-w-[min(100%,11rem)]")}
					>
						<span className="flex shrink-0 items-center gap-0.5">
							{cwdIsLinkedWorktree ? (
								<LuFolderTree
									className="size-3 text-sky-600/80 dark:text-sky-400/65"
									aria-hidden
								/>
							) : null}
							<TbGitBranch className="size-3 shrink-0" />
						</span>
						<span className="min-w-0 truncate">
							{cwdIsLinkedWorktree
								? `Add worktree · ${cwdRepoFolderName ?? ""}`
								: `Add ${cwdRepoFolderName ?? ""}`}
						</span>
					</Button>
				) : null}
				<Button
					variant="ghost"
					size="xs"
					onClick={onAddFolders}
					disabled={disabled}
					title="Pick folders to track"
					className={cn(BTN_ROW)}
				>
					<LuFolderPlus className="size-3 shrink-0" />
					<span className="min-w-0 truncate">Add New</span>
				</Button>
			</div>
			{footerMsg ? (
				<p className="mt-0.5 px-0.5 text-center text-[10px] leading-tight text-muted-foreground/65">
					{footerMsg}
				</p>
			) : null}
		</header>
	);
}
