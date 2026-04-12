import { useState, type CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { RenameEntityDialog } from "@/components/rename/RenameEntityDialog";
import {
	cwdToAbsolute,
	selectAppHeaderSlice,
	useTerminalStore,
} from "@/store/terminals";
import { useRenameUiStore } from "@/store/renameUiStore";
import { useAppConfigStore } from "@/store/appConfig";
import { useHomeDir } from "@/hooks/app/useHomeDir";
import { useAppLayoutShortcuts } from "@/hooks/app/useAppLayoutShortcuts";
import { useWindowAndQuitCloseGuard } from "@/hooks/app/useWindowAndQuitCloseGuard";
import { AppTitlebar } from "@/components/layout/AppTitlebar";
import { AppMainArea } from "@/components/layout/AppMainArea";

// Main window: settings popup, left workspace list, top bar, terminal area. Keys are wired in useAppLayoutShortcuts.
export function AppLayout() {
	const createWorkspace = useTerminalStore((s) => s.createWorkspace);
	const headerSlice = useTerminalStore(useShallow(selectAppHeaderSlice));
	const activeCwd = headerSlice.cwd;
	const headerBranch = headerSlice.branch;
	const renameOpen = useRenameUiStore((s) => s.target !== null);

	const homeDir = useHomeDir();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [gitPanelOpen, setGitPanelOpen] = useState(false);

	const { increaseFontSize, decreaseFontSize } = useAppConfigStore();
	useAppLayoutShortcuts({
		sidebarOpen,
		setSidebarOpen,
		setGitPanelOpen,
		increaseFontSize,
		decreaseFontSize,
	});

	useWindowAndQuitCloseGuard();

	// Single resolved path for titlebar + git when we know HOME
	const resolvedCwd = homeDir ? cwdToAbsolute(activeCwd, homeDir) : activeCwd;

	return (
		<>
			<SettingsDialog />
			{renameOpen ? <RenameEntityDialog /> : null}
			<SidebarProvider
				open={sidebarOpen}
				onOpenChange={setSidebarOpen}
				style={{ "--sidebar-width": "270px" } as CSSProperties}
			>
				<div className="flex h-screen min-h-0 w-screen flex-col overflow-hidden border-b-2 border-border">
					<AppTitlebar
						sidebarOpen={sidebarOpen}
						headerPwd={resolvedCwd}
						headerBranch={headerBranch}
						onCreateWorkspace={createWorkspace}
						onToggleSidebar={() => setSidebarOpen((o) => !o)}
						gitPanelOpen={gitPanelOpen}
						onToggleGitPanel={() => setGitPanelOpen((o) => !o)}
					/>
					<AppMainArea
						gitPanelOpen={gitPanelOpen}
						gitActiveCwd={resolvedCwd}
					/>
				</div>
			</SidebarProvider>
		</>
	);
}
