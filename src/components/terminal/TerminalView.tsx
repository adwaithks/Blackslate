import { memo, useMemo } from "react";
import {
	useSessionStore,
	selectActiveWorkspaceTabBarSignature,
	selectTerminalStackSignature,
	buildMountedTerminalRows,
} from "@/store/sessions";
import { TerminalPane } from "./TerminalPane";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { MessageComposer } from "./MessageComposer";
import { useTerminalSurface } from "@/hooks/useTerminalSurface";
import { useTerminalFileDropToPty } from "@/hooks/useTerminalFileDropToPty";

/**
 * Stacked xterm surfaces for every mounted session. Subscribes only to a layout
 * signature so unrelated session updates do not re-render the whole stack.
 */
const TerminalStack = memo(function TerminalStack({
	terminalSurface,
}: {
	terminalSurface: string;
}) {
	const stackSignature = useSessionStore(selectTerminalStackSignature);
	const rows = useMemo(
		() => buildMountedTerminalRows(useSessionStore.getState()),
		[stackSignature],
	);

	return (
		<div className="relative min-h-0 flex-1">
			{rows.map(({ sessionId, isActive }) => (
				<div
					key={sessionId}
					className="absolute inset-0"
					style={{
						backgroundColor: terminalSurface,
						visibility: isActive ? "visible" : "hidden",
					}}
					inert={!isActive}
				>
					<TerminalPane
						sessionId={sessionId}
						isActive={isActive}
						terminalSurface={terminalSurface}
					/>
				</div>
			))}
		</div>
	);
});

/**
 * Renders a TerminalPane for every mounted session across every workspace simultaneously.
 *
 * All surfaces stay mounted so PTYs keep running regardless of which workspace or
 * tab is active — switching is instant with zero shell state loss.
 *
 * Inactive surfaces use `visibility: hidden` (not `display: none`) so xterm.js
 * can still measure container dimensions via ResizeObserver. Each inactive
 * wrapper also sets `inert` so focus does not land in a hidden terminal.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  WorkspaceTabBar (32px)     │  ← tabs for active workspace's sessions
 *   ├─────────────────────────────┤
 *   │  Terminal stack (flex-1)    │  ← all sessions stacked, one visible
 *   └─────────────────────────────┘
 */
export function TerminalView() {
	useTerminalFileDropToPty();

	useSessionStore(selectActiveWorkspaceTabBarSignature);

	const showMessageComposer = false; // on the way

	const terminalSurface = useTerminalSurface();

	return (
		<div className="flex h-full w-full flex-col">
			<WorkspaceTabBar />

			<TerminalStack terminalSurface={terminalSurface} />

			<div className="bg-background">
				{showMessageComposer && <MessageComposer />}
			</div>
		</div>
	);
}
