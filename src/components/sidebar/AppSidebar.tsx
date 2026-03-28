import { BiGitBranch } from "react-icons/bi";
import { IoClose } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	useSessionStore,
	sessionDisplayName,
	type Session,
	type ClaudeState,
} from "@/store/sessions";
import {
	projectStackIcon,
	sortProjectStack,
} from "@/lib/projectStack";
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

function ClaudeIndicator({ state, model }: { state: ClaudeState; model: string | null }) {
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
// Session item
// ---------------------------------------------------------------------------

interface SessionItemProps {
	session: Session;
	index: number;
	isActive: boolean;
	onActivate: () => void;
	onClose: () => void;
}

function SessionItem({
	session,
	index,
	isActive,
	onActivate,
	onClose,
}: SessionItemProps) {
	const dirName = session.claudeSessionTitle ?? sessionDisplayName(session);
	const { git, projectStack } = session;
	const stacks = sortProjectStack(projectStack);

	return (
		<Tooltip>
			<SidebarMenuItem>
				<TooltipTrigger className="w-full">
					<SidebarMenuButton
						isActive={isActive}
						onClick={onActivate}
						className={cn(
							"group/item h-auto flex-col items-start gap-2 py-2 px-2",
							"rounded-md transition-colors",
							/* Beat shadcn `[&_svg]:size-4` on SidebarMenuButton for session rows */
							"[&_svg]:!size-2.5",
							isActive
								? "data-active:bg-white/14! hover:data-active:bg-white/18!"
								: "bg-white/6! hover:bg-white/10!",
						)}
					>
						{/* Row 1: status dot + "#N dirname" — primary */}
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
							{session.claudeCodeActive && (
								<ClaudeIndicator state={session.claudeState} model={session.claudeModel} />
							)}
						</div>

						{/* Row 2: cwd path — secondary */}
						<span className="pl-[14px] text-[10px] text-muted-foreground/55 truncate w-full leading-none tracking-wide">
							{session.cwd}
						</span>

						{/* Row 3: git branch + dirty dot — only when in a repo */}
						{git && (
							<div className="pl-[14px] flex items-center gap-1.5 w-full min-w-0">
								<BiGitBranch className="!size-2 shrink-0 text-muted-foreground/50" />
								<span className="text-[10px] text-muted-foreground/60 truncate leading-none tracking-wide">
									{git.branch}
								</span>
								{git.dirty && (
									<span className="size-1.5 rounded-full bg-white/45 shrink-0" />
								)}
							</div>
						)}

						{/* Row 4: project stacks (Rust, Go, Node, …) — from `project_stack` */}
						{stacks.length > 0 && (
							<div className="pl-[14px] flex flex-wrap items-center gap-x-2 gap-y-1 w-full min-w-0 [&_svg]:!size-2">
								{stacks.map((s) => {
									const Icon = projectStackIcon(s.id);
									const ver = s.version ? ` ${s.version}` : "";
									return (
										<span
											key={s.id}
											className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70 leading-none tracking-wide"
											title={`${s.label}${ver}`}
										>
											<Icon
												className="!size-2 shrink-0 opacity-80"
												aria-hidden
											/>
											<span className="truncate max-w-36">
												{s.label}
												{s.version && (
													<span className="text-muted-foreground/50">
														{" "}
														{s.version}
													</span>
												)}
											</span>
										</span>
									);
								})}
							</div>
						)}
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
					<span className="sr-only">Close session</span>
				</SidebarMenuAction>
			</SidebarMenuItem>

			<TooltipContent
				side="right"
				sideOffset={8}
				arrowClassName="bg-[#2a2a2d]"
				className="flex max-w-sm flex-col items-start gap-1.5 border border-white/[0.08] bg-[#2a2a2d] px-3 py-2 text-[#eceae6] shadow-lg"
			>
				{/* Row 1: session name */}
				<span className="text-xs font-medium leading-none tracking-tight text-[#f2f0eb]">
					<span className="mr-2 text-[#eceae6]/45">#{index + 1}</span>
					{dirName}
				</span>

				{/* Row 2: full cwd */}
				<span className="break-all text-[10px] leading-none tracking-wide text-[#d8d6d0]/85">
					{session.cwd}
				</span>

				{/* Row 3: git branch */}
				{git && (
					<div className="flex items-center gap-1.5 text-[#d8d6d0]/85">
						<BiGitBranch className="size-2.5 shrink-0 text-[#eceae6]/50" />
						<span className="text-[10px] leading-none tracking-wide">
							{git.branch}
						</span>
						{git.dirty && (
							<span className="size-1.5 shrink-0 rounded-full bg-[#eceae6]/55" />
						)}
					</div>
				)}

				{/* Row 4: project stacks */}
				{stacks.length > 0 && (
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						{stacks.map((s) => {
							const Icon = projectStackIcon(s.id);
							return (
								<span
									key={s.id}
									className="inline-flex items-center gap-0.5 text-[10px] leading-none tracking-wide text-[#d8d6d0]/90"
								>
									<Icon className="size-2 shrink-0 text-[#eceae6]/70" aria-hidden />
									<span>
										{s.label}
										{s.version && (
											<span className="text-[#d8d6d0]/65"> {s.version}</span>
										)}
									</span>
								</span>
							);
						})}
					</div>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function AppSidebar() {
	const { sessions, activeId, closeSession, activateSession } =
		useSessionStore();

	return (
		<TooltipProvider>
			<Sidebar collapsible="offcanvas">
				<SidebarContent className="mt-8">
					<SidebarGroup className="px-1.5">
						<SidebarGroupContent>
							<SidebarMenu className="gap-1">
								{sessions.map((session, index) => (
									<SessionItem
										key={session.id}
										session={session}
										index={index}
										isActive={session.id === activeId}
										onActivate={() =>
											activateSession(session.id)
										}
										onClose={() => closeSession(session.id)}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</TooltipProvider>
	);
}
