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
}

export function AppTitlebar({
	sidebarOpen,
	headerPwd,
	headerBranch,
	onCreateWorkspace,
	onToggleSidebar,
	gitPanelOpen,
	onToggleGitPanel,
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
			/>
		</div>
	);
}
