import { useMemo } from "react";
import { useSessionStore, selectActiveWorkspace } from "@/store/sessions";
import { TerminalPane } from "./TerminalPane";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { MessageComposer } from "./MessageComposer";
import { useTerminalSurface } from "@/hooks/useTerminalSurface";

/**
 * Renders a TerminalPane for every session across every workspace simultaneously.
 *
 * All panes stay mounted so PTYs keep running regardless of which workspace or
 * tab is active — switching is instant with zero shell state loss.
 *
 * Inactive panes use `visibility: hidden` (not `display: none`) so xterm.js
 * can still measure container dimensions via ResizeObserver. Each inactive
 * wrapper also sets `inert` so focus does not land in a hidden terminal.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  WorkspaceTabBar (32px)     │  ← tabs for active workspace's sessions
 *   ├─────────────────────────────┤
 *   │  Terminal pane (flex-1)     │  ← all sessions stacked, one visible
 *   └─────────────────────────────┘
 */
export function TerminalView() {
	const { workspaces, activeWorkspaceId } = useSessionStore();
	const activeWorkspace = selectActiveWorkspace({
		workspaces,
		activeWorkspaceId,
	});

	const paneList = useMemo(
		() =>
			workspaces.flatMap((workspace) =>
				workspace.sessions.map((session) => ({
					workspace,
					session,
				})),
			),
		[workspaces],
	);

	const showMessageComposer = false; // on the way

	const terminalSurface = useTerminalSurface();

	return (
		<div className="flex h-full w-full flex-col">
			{activeWorkspace && <WorkspaceTabBar workspace={activeWorkspace} />}

			<div className="relative flex-1 min-h-0">
				{paneList.map(({ workspace, session }) => {
					const isActive =
						workspace.id === activeWorkspaceId &&
						session.id === workspace.activeSessionId;
					return (
						<div
							key={session.id}
							className="absolute inset-0"
							style={{
								backgroundColor: terminalSurface,
								visibility: isActive ? "visible" : "hidden",
							}}
							inert={!isActive}
						>
							<TerminalPane
								sessionId={session.id}
								isActive={isActive}
								terminalSurface={terminalSurface}
							/>
						</div>
					);
				})}
			</div>
			<div className="bg-background">
				{showMessageComposer && <MessageComposer />}
			</div>
		</div>
	);
}
