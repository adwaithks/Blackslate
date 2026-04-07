import type { TurnUsage } from "@/store/sessions";
import { TitlebarSidebarSection } from "@/components/layout/titlebar/TitlebarSidebarSection";
import { TitlebarMainSection } from "@/components/layout/titlebar/TitlebarMainSection";

export interface AppTitlebarProps {
	/** Whether the left sidebar column is expanded (drives titlebar grid + toggle icon). */
	sidebarOpen: boolean;
	/** Absolute cwd string for the path label and session picker. */
	headerPwd: string;
	/** Current git branch for active session’s cwd, when known. */
	headerBranch: string | null;
	onCreateWorkspace: () => void;
	onToggleSidebar: () => void;
	gitPanelOpen: boolean;
	onToggleGitPanel: () => void;
	/** Running total of token usage for this terminal session (sum of completed turns). */
	cumulativeUsage: TurnUsage | null;
	/** Most recent completed turn only (tooltip detail). */
	lastTurnUsage: TurnUsage | null;
	/** API model id (best-effort, used for context window inference). */
	claudeModel: string | null;
}

/**
 * macOS titlebar row: drag region, workspace controls, cwd, model + Claude gear menu, git toggle.
 * Grid columns align with the sidebar width below (see parent).
 */
export function AppTitlebar({
	sidebarOpen,
	headerPwd,
	headerBranch,
	onCreateWorkspace,
	onToggleSidebar,
	gitPanelOpen,
	onToggleGitPanel,
	cumulativeUsage,
	lastTurnUsage,
	claudeModel,
}: AppTitlebarProps) {
	return (
		<div
			className="relative z-20 grid h-[34px] shrink-0"
			style={{
				gridTemplateColumns: sidebarOpen
					? "var(--sidebar-width) minmax(0, 1fr)"
					: "minmax(76px, auto) minmax(0, 1fr)",
			}}
		>
			<TitlebarSidebarSection
				sidebarOpen={sidebarOpen}
				onCreateWorkspace={onCreateWorkspace}
				onToggleSidebar={onToggleSidebar}
			/>
			<TitlebarMainSection
				headerPwd={headerPwd}
				headerBranch={headerBranch}
				claudeModel={claudeModel}
				gitPanelOpen={gitPanelOpen}
				onToggleGitPanel={onToggleGitPanel}
				cumulativeUsage={cumulativeUsage}
				lastTurnUsage={lastTurnUsage}
			/>
		</div>
	);
}
