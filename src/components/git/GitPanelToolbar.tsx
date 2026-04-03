import { Button } from "@/components/ui/button";
import { lineTabsStripMinHeightClass } from "@/components/ui/tabs";
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

// Compact toolbar buttons; session-repo label truncates with max-width on that row only.
const BTN_ROW =
	"h-6 min-h-6 w-auto shrink-0 justify-center gap-1 px-1.5 py-0 text-[11px] leading-none text-muted-foreground hover:text-foreground";

/**
 * Top row: add current session’s repo (when applicable), then pick folders to track.
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
	const disabled = addingFolders || addingCurrent;

	return (
		<header className="shrink-0 bg-background h-10 px-1.5 py-1">
			<div
				className={cn(
					"flex min-w-0 flex-wrap items-center justify-end gap-1",
					lineTabsStripMinHeightClass,
				)}
			>
				{sessionRepoRoot !== undefined && showAddSessionRepo ? (
					<Button
						variant="ghost"
						size="xs"
						onClick={onAddSessionRepo}
						disabled={disabled}
						title={sessionRepoRoot ?? undefined}
						className={cn(BTN_ROW, "max-w-[min(100%,11rem)]")}
					>
						<TbGitBranch className="size-3 shrink-0" />
						<span className="min-w-0 truncate">
							Add {sessionRootFolderName}
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
