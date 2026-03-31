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
	useSessionStore,
	workspaceDisplayName,
	type Session,
	type Workspace,
} from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";
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
	index: number;
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
	index,
	isActive,
	onActivate,
	onClose,
}: WorkspaceItemProps) {
	const closeSession = useSessionStore((s) => s.closeSession);
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
										? "data-active:bg-white/6! hover:data-active:bg-white/28!"
										: "hover:bg-white/10!",
								)}
							>
						{/* Row 1: dot, index + title, tab pill, Claude pill */}
						<div className="flex w-full min-w-0 items-center gap-2">
							<span
								className={cn(
									"size-1.5 shrink-0 rounded-full transition-colors",
									isActive ? "bg-green-300" : "bg-white/30",
								)}
							/>
							<span className="min-w-0 flex-1 truncate text-xs leading-none tracking-tight">
								<span className="mr-2 text-muted-foreground/55">
									#{index + 1}
								</span>
								{dirName}
							</span>
							{tabCount > 1 && (
								<span className="shrink-0 rounded-full px-1 py-px text-[9px] tabular-nums text-muted-foreground bg-white/5">
									{tabCount}
								</span>
							)}
							{session.claudeCodeActive && (
								<ClaudeIndicator
									state={session.claudeState}
									model={session.claudeModel}
								/>
							)}
						</div>

						{/* Row 2: optional git branch + cwd (truncated in row; full path in tooltip) */}
						<div className="flex w-full min-w-0 items-center gap-1.5 pl-[14px]">
							{git && (
								<>
									<PiGitBranchDuotone
										className="size-2.5 shrink-0 text-muted-foreground/50"
										aria-hidden
									/>
									<span className="max-w-[42%] shrink truncate text-[10px] leading-none tracking-wide text-muted-foreground/65">
										{git.branch}
									</span>
									<span
										className="shrink-0 px-0.5 text-[10px] text-muted-foreground/35"
										aria-hidden
									>
										·
									</span>
								</>
							)}
							<IoFolder
								className="size-2.5 shrink-0 text-muted-foreground/50"
								aria-hidden
							/>
							<span className="min-w-0 flex-1 truncate text-[10px] leading-none tracking-wide text-muted-foreground/65">
								{session.cwd}
							</span>
						</div>
					</SidebarMenuButton>
						</TooltipTrigger>
					</ContextMenuTrigger>

					<ContextMenuContent className="min-w-44 border-white/[0.08] bg-[#1c1c1f] text-[#eceae6]">
						<ContextMenuItem
							className="gap-2 text-xs focus:bg-white/[0.08]"
							onClick={() => openRenameWorkspace(workspace.id)}
						>
							<IoPencil className="size-3.5 opacity-70" aria-hidden />
							Rename
							<ContextMenuShortcut className="text-white/35">
								⌘R
							</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem
							className="gap-2 text-xs focus:bg-white/[0.08]"
							onClick={() =>
								closeSession(workspace.id, workspace.activeSessionId)
							}
						>
							<IoClose className="size-3.5 opacity-70" aria-hidden />
							Close tab
							<ContextMenuShortcut className="text-white/35">
								⌘Q
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
				arrowClassName="bg-[#2a2a2d]"
				className="flex max-w-sm flex-col items-start gap-1.5 border border-white/[0.08] bg-[#2a2a2d] px-3 py-2 text-[#eceae6] shadow-lg"
			>
				<span className="text-xs font-medium leading-none tracking-tight text-[#f2f0eb]">
					<span className="mr-2 text-[#eceae6]/45">#{index + 1}</span>
					{dirName}
					{tabCount > 1 && (
						<span className="ml-2 text-[10px] font-normal text-[#eceae6]/40">
							{tabCount} tabs
						</span>
					)}
				</span>

				<div className="flex w-full min-w-0 items-center gap-1.5">
					{git && (
						<>
							<PiGitBranchDuotone
								className="size-2.5 shrink-0 text-[#eceae6]/55"
								aria-hidden
							/>
							<span className="max-w-[42%] shrink truncate text-[10px] leading-none tracking-wide text-[#d8d6d0]/90">
								{git.branch}
							</span>
							<span
								className="shrink-0 px-0.5 text-[10px] text-[#eceae6]/35"
								aria-hidden
							>
								·
							</span>
						</>
					)}
					<IoFolder
						className="size-2.5 shrink-0 text-[#eceae6]/55"
						aria-hidden
					/>
					<span className="min-w-0 flex-1 break-all text-[10px] leading-snug tracking-wide text-[#d8d6d0]/85">
						{session.cwd}
					</span>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
