import { IoAdd, IoClose, IoPencil } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	useSessionStore,
	terminalDisplayName,
	type Session,
	type Workspace,
} from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

interface WorkspaceTabBarProps {
	workspace: Workspace;
}

export function WorkspaceTabBar({ workspace }: WorkspaceTabBarProps) {
	const { activateSession, closeSession, createSessionInWorkspace } =
		useSessionStore();

	const activeId = workspace.activeSessionId;

	return (
		<Tabs
			value={activeId}
			onValueChange={(id) => activateSession(workspace.id, id as string)}
		>
			<div className="flex items-center flex-row border-b border-white/4">
				<TabsList className="rounded-md" variant="line">
					{workspace.sessions.map((session) => (
						<SessionTabTrigger
							key={session.id}
							workspaceId={workspace.id}
							session={session}
							onClose={() =>
								closeSession(workspace.id, session.id)
							}
						/>
					))}
				</TabsList>

				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="ml-1 h-6 shrink-0 px-1 text-muted-foreground rounded-sm"
					onClick={() => createSessionInWorkspace(workspace.id)}
					title="New tab (⌘T)"
					aria-label="New tab"
				>
					<IoAdd className="size-4 shrink-0" />
				</Button>
			</div>
		</Tabs>
	);
}

interface SessionTabTriggerProps {
	workspaceId: string;
	session: Session;
	onClose: () => void;
}

function SessionTabTrigger({
	workspaceId,
	session,
	onClose,
}: SessionTabTriggerProps) {
	const openRenameSession = useRenameUiStore((s) => s.openSession);
	const closeSession = useSessionStore((s) => s.closeSession);

	const label = terminalDisplayName(session);

	return (
		<ContextMenu>
			<ContextMenuTrigger
				className="inline-flex min-w-0 flex-1"
				render={
					<TabsTrigger
						className={cn(
							"group/tab w-48 max-w-68",
							"justify-between gap-1 px-2",
						)}
						value={session.id}
					>
						{session.claudeCodeActive && (
							<SiClaude
								className={cn(
									"size-2.5 shrink-0",
									session.claudeState === "thinking"
										? "text-[#D97757] animate-pulse"
										: "text-[#D97757]",
								)}
								aria-hidden
							/>
						)}

						<span className="min-w-0 flex-1 truncate text-xs text-center">
							{label}
						</span>

						<button
							type="button"
							className={cn(
								"ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 transition-opacity",
								"opacity-0 group-hover/tab:opacity-100",
								"hover:bg-white/10 hover:text-muted-foreground",
							)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={(e) => {
								e.stopPropagation();
								onClose();
							}}
							title="Close tab"
							aria-label={`Close ${label}`}
						>
							<IoClose className="size-3" />
						</button>
					</TabsTrigger>
				}
			/>

			<ContextMenuContent className="min-w-44 border-white/[0.08] bg-[#1c1c1f] text-[#eceae6]">
				<ContextMenuItem
					className="gap-2 text-xs focus:bg-white/[0.08]"
					onClick={() => openRenameSession(session.id)}
				>
					<IoPencil className="size-3.5 opacity-70" aria-hidden />
					Rename
					<ContextMenuShortcut className="text-white/35">
						⌘R
					</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem
					className="gap-2 text-xs focus:bg-white/[0.08]"
					onClick={() => closeSession(workspaceId, session.id)}
				>
					<IoClose className="size-3.5 opacity-70" aria-hidden />
					Close tab
					<ContextMenuShortcut className="text-white/35">
						⌘Q
					</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
