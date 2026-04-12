import { memo, useMemo } from "react";
import {
	useTerminalStore,
	selectActiveWorkspaceTabBarSignature,
	selectTerminalStackSignature,
	buildMountedTerminalRows,
} from "@/store/terminals";
import { TerminalPane } from "./TerminalPane";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { useTerminalSurface } from "@/hooks/terminal/useTerminalSurface";
import { useTerminalFileDropToPty } from "@/hooks/terminal/useTerminalFileDropToPty";

// One terminal screen per open tab, stacked. Only re-draws when tab layout changes.
const TerminalStack = memo(function TerminalStack({
	terminalSurface,
}: {
	terminalSurface: string;
}) {
	const stackSignature = useTerminalStore(selectTerminalStackSignature);
	const rows = useMemo(
		() => buildMountedTerminalRows(useTerminalStore.getState()),
		[stackSignature],
	);

	return (
		<div className="relative min-h-0 flex-1">
			{rows.map(({ terminalId, isActive }) => (
				<div
					key={terminalId}
					className="absolute inset-0"
					style={{
						backgroundColor: terminalSurface,
						visibility: isActive ? "visible" : "hidden",
					}}
					inert={!isActive}
				>
					<TerminalPane
						terminalId={terminalId}
						isActive={isActive}
						terminalSurface={terminalSurface}
					/>
				</div>
			))}
		</div>
	);
});

// Shows every open shell tab for every workspace at once, but only one is visible.
// Hidden tabs stay alive so you don't lose your place when you switch.
// Hidden ones stay in the layout (not fully removed) so size math still works; they can't take focus.
// Top: tab strip for the current workspace. Below: stacked terminal areas.
export function TerminalView() {
	useTerminalFileDropToPty();

	useTerminalStore(selectActiveWorkspaceTabBarSignature);

	const terminalSurface = useTerminalSurface();

	return (
		<div className="flex h-full w-full flex-col">
			<WorkspaceTabBar />

			<TerminalStack terminalSurface={terminalSurface} />
		</div>
	);
}
