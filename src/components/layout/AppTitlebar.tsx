import type { TurnUsage } from "@/store/sessions";
import { TitlebarSidebarSection } from "@/components/layout/titlebar/TitlebarSidebarSection";
import { TitlebarMainSection } from "@/components/layout/titlebar/TitlebarMainSection";

export interface AppTitlebarProps {
	sidebarOpen: boolean;
	headerPwd: string;
	headerBranch: string | null;
	onCreateWorkspace: () => void;
	onToggleSidebar: () => void;
	gitPanelOpen: boolean;
	onToggleGitPanel: () => void;
	cumulativeUsage: TurnUsage | null;
	lastTurnUsage: TurnUsage | null;
}

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
				gitPanelOpen={gitPanelOpen}
				onToggleGitPanel={onToggleGitPanel}
				cumulativeUsage={cumulativeUsage}
				lastTurnUsage={lastTurnUsage}
			/>
		</div>
	);
}
