import { Button } from "@/components/ui/button";
import { LuFolderPlus } from "react-icons/lu";
import { TbGitBranch } from "react-icons/tb";
import { cn } from "@/lib/utils";

interface GitPanelToolbarProps {
	addingFolders: boolean;
	addingCurrent: boolean;
	onAddFolders: () => void;
	onAddSessionRepo: () => void;
	/** `undefined` while discovering whether active cwd is inside a git repo */
	sessionRepoRoot: string | null | undefined;
	showAddSessionRepo: boolean;
	sessionRootFolderName: string | null;
	footerMsg: string | null;
}

/**
 * Top row: pick folders to track, optionally add current session’s repo by basename.
 */
export function GitPanelToolbar({
	addingFolders,
	addingCurrent,
	onAddFolders,
	onAddSessionRepo,
	sessionRepoRoot,
	showAddSessionRepo,
	sessionRootFolderName,
	footerMsg,
}: GitPanelToolbarProps) {
	return (
		<header className="shrink-0 border-b border-border/20 bg-background px-1.5 py-1">
			<div className="flex min-w-0 gap-1">
				<Button
					variant="ghost"
					size="sm"
					onClick={onAddFolders}
					disabled={addingFolders || addingCurrent}
					title="Pick folders to track"
					className={cn(
						"h-6 min-h-6 justify-center gap-1 px-1 py-0 text-[11px] leading-none text-muted-foreground hover:text-foreground",
						showAddSessionRepo ? "min-w-0 flex-1" : "w-full",
					)}
				>
					<LuFolderPlus className="size-3 shrink-0" />
					<span className="min-w-0 truncate">Add New</span>
				</Button>
				{sessionRepoRoot !== undefined && showAddSessionRepo ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={onAddSessionRepo}
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
	);
}
