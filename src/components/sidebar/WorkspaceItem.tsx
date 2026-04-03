import { PiGitBranchDuotone } from "react-icons/pi";
import { IoClose, IoFolder, IoPencil } from "react-icons/io5";
import {
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import {
	workspaceDisplayName,
	type Session,
	type Workspace,
} from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";
import {
	HEADER_REPO_ICON,
	HEADER_REPO_SEP,
	HEADER_REPO_TEXT,
} from "@/lib/headerRepoLineStyles";
import { cn } from "@/lib/utils";
import { ClaudeIndicator } from "@/components/sidebar/ClaudeIndicator";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface WorkspaceItemProps {
	workspace: Workspace;
	/** Active session within this workspace — drives the row label, cwd, and Claude line. */
	session: Session;
	isActive: boolean;
	onActivate: () => void;
	onClose: () => void;
}

/**
 * One workspace row: switch workspace on click, close on the × (does not bubble to activate).
 * Tooltip repeats name + full cwd for overflow cases.
 */
export function WorkspaceItem({
	workspace,
	session,
	isActive,
	onActivate,
	onClose,
}: WorkspaceItemProps) {
	const openRenameWorkspace = useRenameUiStore((s) => s.openWorkspace);

	const dirName = workspaceDisplayName(workspace);
	const { git } = session;
	const tabCount = workspace.sessions.length;

	return (
		<Tooltip>
			<SidebarMenuItem>
				<ContextMenu>
					<ContextMenuTrigger className="w-full">
						<TooltipTrigger className="w-full">
							<SidebarMenuButton
								isActive={isActive}
								onClick={onActivate}
								className={cn(
									"group/item h-auto flex-col items-start gap-2 py-2 px-2",
									"rounded-sm transition-colors",
									"[&_svg]:!size-2.5",
									isActive
										? [
												"data-active:bg-accent!",
												"hover:data-active:bg-secondary/90!",
											]
										: "hover:bg-muted/55",
								)}
							>
								{/* Row 1: dot, title, tab pill, Claude pill */}
								<div className="flex w-full min-w-0 items-center gap-2">
									<span
										className={cn(
											"size-1.5 shrink-0 rounded-full transition-colors",
											isActive
												? "bg-green-300"
												: "bg-muted-foreground/35",
										)}
									/>
									<span className="min-w-0 flex-1 truncate text-xs leading-none tracking-tight">
										{dirName}
									</span>
									{tabCount > 1 && (
										<span className="shrink-0 rounded-full bg-muted/50 px-1 py-px text-[9px] tabular-nums text-muted-foreground">
											{tabCount}
										</span>
									)}
								</div>

								{/* Row 2: optional git branch + cwd (truncated in row; full path in tooltip) */}
								<div className="flex w-full min-w-0 items-center gap-1.5 pl-[14px]">
									{git && (
										<>
											<PiGitBranchDuotone
												className={cn(
													"size-2.5 shrink-0",
													HEADER_REPO_ICON,
												)}
												aria-hidden
											/>
											<span
												className={cn(
													"max-w-[42%] shrink truncate text-[10px] leading-none tracking-wide",
													HEADER_REPO_TEXT,
												)}
											>
												{git.branch}
											</span>
											<span
												className={cn(
													"shrink-0 px-0.5 text-[10px]",
													HEADER_REPO_SEP,
												)}
												aria-hidden
											>
												·
											</span>
										</>
									)}
									<IoFolder
										className={cn(
											"size-2.5 shrink-0",
											HEADER_REPO_ICON,
										)}
										aria-hidden
									/>
									<span
										className={cn(
											"min-w-0 flex-1 truncate text-[10px] leading-none tracking-wide",
											HEADER_REPO_TEXT,
										)}
									>
										{session.cwd}
									</span>
								</div>

								{/* Row 3: Claude model name if active */}
								{session.claudeCodeActive &&
									session.claudeModel && (
										<div className="flex w-full items-center gap-1 pl-[14px]">
											<ClaudeIndicator
												model={session.claudeModel}
											/>
										</div>
									)}
							</SidebarMenuButton>
						</TooltipTrigger>
					</ContextMenuTrigger>

					<ContextMenuContent className="min-w-48">
						<ContextMenuItem
							className="gap-2 text-xs"
							onClick={() => openRenameWorkspace(workspace.id)}
						>
							<IoPencil
								className="size-3.5 opacity-70"
								aria-hidden
							/>
							Rename
							<ContextMenuShortcut className="text-muted-foreground">
								⌘⇧R
							</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem
							className="gap-2 text-xs"
							onClick={() => onClose()}
						>
							<IoClose
								className="size-3.5 opacity-70"
								aria-hidden
							/>
							Close workspace
							<ContextMenuShortcut className="text-muted-foreground">
								⌘⇧W
							</ContextMenuShortcut>
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>

				<SidebarMenuAction
					className="[&>svg]:!size-2.5"
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					showOnHover
				>
					<IoClose className="!size-2.5" />
					<span className="sr-only">Close workspace</span>
				</SidebarMenuAction>
			</SidebarMenuItem>

			<TooltipContent
				side="right"
				sideOffset={8}
				className="flex max-w-sm flex-col items-start gap-1.5 px-3 py-2 shadow-lg"
			>
				<span className="text-xs font-medium leading-none tracking-tight text-popover-foreground">
					{dirName}
					{tabCount > 1 && (
						<span className="ml-2 text-[10px] font-normal text-muted-foreground">
							{tabCount} tabs
						</span>
					)}
				</span>

				<div className="flex w-full min-w-0 items-center gap-1.5">
					{git && (
						<>
							<PiGitBranchDuotone
								className="size-2.5 shrink-0 text-muted-foreground/70"
								aria-hidden
							/>
							<span className="max-w-[42%] shrink truncate text-[10px] leading-none tracking-wide text-popover-foreground/90">
								{git.branch}
							</span>
							<span
								className="shrink-0 px-0.5 text-[10px] text-muted-foreground/50"
								aria-hidden
							>
								·
							</span>
						</>
					)}
					<IoFolder
						className="size-2.5 shrink-0 text-muted-foreground/70"
						aria-hidden
					/>
					<span className="min-w-0 flex-1 break-all text-[10px] leading-snug tracking-wide text-popover-foreground/85">
						{session.cwd}
					</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
