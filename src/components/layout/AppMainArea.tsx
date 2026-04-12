import { memo } from "react";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { GitPanel } from "@/components/git/GitPanel";

interface AppMainAreaProps {
	// Whether the source-control side panel is open.
	gitPanelOpen: boolean;
	// Full folder path for git (matches the title bar when we know your home folder).
	gitActiveCwd: string;
}

// Left list, middle terminal, optional right git panel. Grows to fill space under the title bar.
function AppMainAreaImpl({ gitPanelOpen, gitActiveCwd }: AppMainAreaProps) {
	return (
		<div className="flex min-h-0 flex-1">
			<AppSidebar />
			<main className="min-h-0 flex-1">
				<TerminalView />
			</main>
			<GitPanel open={gitPanelOpen} activeCwd={gitActiveCwd} />
		</div>
	);
}

export const AppMainArea = memo(
	AppMainAreaImpl,
	(prev, next) =>
		prev.gitPanelOpen === next.gitPanelOpen &&
		prev.gitActiveCwd === next.gitActiveCwd,
);
