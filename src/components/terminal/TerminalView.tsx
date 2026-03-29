import { useSessionStore, selectActiveWorkspace } from "@/store/sessions";
import { TerminalPane } from "./TerminalPane";
import { WorkspaceTabBar } from "./WorkspaceTabBar";

/**
 * Renders a TerminalPane for every session across every workspace simultaneously.
 *
 * All panes stay mounted so PTYs keep running regardless of which workspace or
 * tab is active — switching is instant with zero shell state loss.
 *
 * Inactive panes use `visibility: hidden` (not `display: none`) so xterm.js
 * can still measure container dimensions via ResizeObserver.
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
	const activeWorkspace = selectActiveWorkspace({ workspaces, activeWorkspaceId });

	return (
		<div className="flex h-full w-full flex-col">
			{activeWorkspace && <WorkspaceTabBar workspace={activeWorkspace} />}

			<div className="relative flex-1 min-h-0">
				{workspaces.map((workspace) =>
					workspace.sessions.map((session) => {
						const isActive =
							workspace.id === activeWorkspaceId &&
							session.id === workspace.activeSessionId;
						return (
							<div
								key={session.id}
								className="absolute inset-0"
								style={{ visibility: isActive ? "visible" : "hidden" }}
							>
								<TerminalPane
									sessionId={session.id}
									isActive={isActive}
								/>
							</div>
						);
					}),
				)}
			</div>
		</div>
	);
}
