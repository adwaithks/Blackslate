import { FaFolderOpen } from "react-icons/fa";
import { PiGitBranchDuotone } from "react-icons/pi";
import { IoClose, IoFolder } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	useSessionStore,
	sessionDisplayName,
	type Session,
	type Workspace,
	type ClaudeState,
} from "@/store/sessions";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Claude state indicator
// ---------------------------------------------------------------------------

function ClaudeIndicator({
	state,
	model,
}: {
	state: ClaudeState;
	model: string | null;
}) {
	const label =
		state === "thinking"
			? "Claude is thinking…"
			: state === "waiting"
				? "Claude is waiting for your input"
				: "Claude Code running";

	return (
		<span
			className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-[#D97757]"
			title={label}
		>
			<span className="relative flex shrink-0 items-center justify-center size-2.5">
				<SiClaude className="!size-2.5 shrink-0" aria-hidden />
				{state === "thinking" && (
					<span className="absolute inset-0 rounded-full bg-[#D97757]/30 animate-ping" />
				)}
			</span>
			<span className="hidden sm:inline">
				{state === "thinking" ? "…" : (model ?? "Code")}
			</span>
		</span>
	);
}

// ---------------------------------------------------------------------------
// Workspace item — one sidebar row, shows active session's details
// ---------------------------------------------------------------------------

interface WorkspaceItemProps {
	workspace: Workspace;
	/** Active session within this workspace — drives the display. */
	session: Session;
	index: number;
	isActive: boolean;
	onActivate: () => void;
	onClose: () => void;
}

function WorkspaceItem({
	workspace,
	session,
	index,
	isActive,
	onActivate,
	onClose,
}: WorkspaceItemProps) {
	const dirName = session.claudeSessionTitle ?? sessionDisplayName(session);
	const { git } = session;
	const tabCount = workspace.sessions.length;

	return (
		<Tooltip>
			<SidebarMenuItem>
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
						{/* Row 1: status dot + name + tab count + claude indicator */}
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

						{/* Git branch + cwd — single row */}
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

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function AppSidebar() {
	const { workspaces, activeWorkspaceId, closeWorkspace, activateWorkspace } =
		useSessionStore();

	return (
		<TooltipProvider>
			<Sidebar collapsible="offcanvas">
				{/* Clear AppLayout titlebar (z-20); fixed sidebar is z-10 and was fully under it */}
				<SidebarHeader className="pt-12">
					<span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground/70">
						<FaFolderOpen
							className="size-3 shrink-0 text-muted-foreground/55"
							aria-hidden
						/>
						Workspaces
					</span>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup className="px-1.5">
						<SidebarGroupContent>
							<SidebarMenu className="gap-1">
								{workspaces.map((workspace, index) => {
									const session =
										workspace.sessions.find(
											(s) =>
												s.id ===
												workspace.activeSessionId,
										) ?? workspace.sessions[0];
									return (
										<WorkspaceItem
											key={workspace.id}
											workspace={workspace}
											session={session}
											index={index}
											isActive={
												workspace.id ===
												activeWorkspaceId
											}
											onActivate={() =>
												activateWorkspace(workspace.id)
											}
											onClose={() =>
												closeWorkspace(workspace.id)
											}
										/>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</TooltipProvider>
	);
}
