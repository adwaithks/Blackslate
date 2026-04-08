import { memo } from "react";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { GitPanel } from "@/components/git/GitPanel";

interface AppMainAreaProps {
	/** Git panel visibility */
	gitPanelOpen: boolean;
	/** Absolute cwd for git status (same as titlebar path when home is known). */
	gitActiveCwd: string;
}

/**
 * Sidebar + terminal + optional git panel. flex-1 fills space below the titlebar.
 */
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
