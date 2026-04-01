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
import { confirmCloseSessionInWorkspace } from "@/lib/closeConfirm";

interface WorkspaceTabBarProps {
	workspace: Workspace;
}

export function WorkspaceTabBar({ workspace }: WorkspaceTabBarProps) {
	const { activateSession, closeSession, createSessionInWorkspace } =
		useSessionStore();

	const activeId = workspace.activeSessionId;

	const requestCloseSession = async (sessionId: string) => {
		const ok = await confirmCloseSessionInWorkspace(workspace, sessionId);
		if (ok) closeSession(workspace.id, sessionId);
	};

	return (
		<Tabs
			value={activeId}
			onValueChange={(id) => activateSession(workspace.id, id as string)}
		>
			<div className="flex min-w-0 items-stretch border-b border-border bg-background">
				{/*
				 * Tabs + new tab in one row: hugs the left when there is room.
				 * When tabs overflow, + stays sticky to the viewport-right of this strip.
				 */}
				<div className="workspace-tabs-scroll min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
					<div className="flex w-max min-h-8 flex-nowrap items-stretch">
						<TabsList variant="line" className="h-auto min-h-8 flex-nowrap">
							{workspace.sessions.map((session) => (
								<SessionTabTrigger
									key={session.id}
									session={session}
									onClose={() => requestCloseSession(session.id)}
								/>
							))}
						</TabsList>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="sticky right-0 z-10 h-6 shrink-0 cursor-pointer self-center border-l border-border bg-background px-1 text-muted-foreground shadow-[-10px_0_18px_-6px_rgb(0_0_0/0.55)] rounded-sm"
							onClick={() => createSessionInWorkspace(workspace.id)}
							title="New tab (⌘T)"
							aria-label="New tab"
						>
							<IoAdd className="size-4 shrink-0" />
						</Button>
					</div>
				</div>
			</div>
		</Tabs>
	);
}

interface SessionTabTriggerProps {
	session: Session;
	onClose: () => void;
}

function SessionTabTrigger({ session, onClose }: SessionTabTriggerProps) {
	const openRenameSession = useRenameUiStore((s) => s.openSession);

	const label = terminalDisplayName(session);

	return (
		<ContextMenu>
			<ContextMenuTrigger
				className="inline-flex min-w-0 shrink-0"
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
										? "animate-pulse text-claude-accent"
										: "text-claude-accent",
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
								"hover:bg-muted/50 hover:text-muted-foreground",
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

			<ContextMenuContent className="min-w-44">
				<ContextMenuItem
					className="gap-2 text-xs"
					onClick={() => openRenameSession(session.id)}
				>
					<IoPencil className="size-3.5 opacity-70" aria-hidden />
					Rename
					<ContextMenuShortcut className="text-muted-foreground">
						⌘R
					</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem
					className="gap-2 text-xs"
					onClick={() => onClose()}
				>
					<IoClose className="size-3.5 opacity-70" aria-hidden />
					Close tab
					<ContextMenuShortcut className="text-muted-foreground">
						⌘W
					</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
