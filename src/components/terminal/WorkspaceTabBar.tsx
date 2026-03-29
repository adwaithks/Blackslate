import { IoAdd, IoClose } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	useSessionStore,
	sessionDisplayName,
	type Session,
	type Workspace,
} from "@/store/sessions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

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
							session={session}
							onClose={() =>
								closeSession(workspace.id, session.id)
							}
						/>
					))}
				</TabsList>

				<button
					type="button"
					className="flex rounded-sm shrink-0 items-center p-1 ml-1 cursor-pointer text-muted-foreground/40 transition-colors hover:bg-white/[0.04] hover:text-muted-foreground"
					onClick={() => createSessionInWorkspace(workspace.id)}
					title="New tab (⌘T)"
					aria-label="New tab"
				>
					<IoAdd className="size-4" />
				</button>
			</div>
		</Tabs>
	);
}

interface SessionTabTriggerProps {
	session: Session;
	onClose: () => void;
}

function SessionTabTrigger({ session, onClose }: SessionTabTriggerProps) {
	const label = session.claudeSessionTitle ?? sessionDisplayName(session);

	return (
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
	);
}
