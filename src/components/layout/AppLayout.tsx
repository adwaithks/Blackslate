import { useState, type CSSProperties } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { RenameEntityDialog } from "@/components/rename/RenameEntityDialog";
import {
	cwdToAbsolute,
	selectActiveSession,
	useSessionStore,
} from "@/store/sessions";
import { useAppConfigStore, appThemeValue } from "@/store/appConfig";
import { useHomeDir } from "@/hooks/useHomeDir";
import { useApplyAppTheme } from "@/hooks/useApplyAppTheme";
import { useAppLayoutShortcuts } from "@/hooks/useAppLayoutShortcuts";
import { useWindowAndQuitCloseGuard } from "@/hooks/useWindowAndQuitCloseGuard";
import { AppTitlebar } from "@/components/layout/AppTitlebar";
import { AppMainArea } from "@/components/layout/AppMainArea";

/**
 * Root shell: settings modal, shadcn sidebar (workspace list), titlebar, terminal.
 * Keyboard shortcuts live in useAppLayoutShortcuts + lib/appLayoutShortcuts.
 */
export function AppLayout() {
	const { workspaces, activeWorkspaceId, createWorkspace } =
		useSessionStore();
	const activeSession = selectActiveSession({
		workspaces,
		activeWorkspaceId,
	});
	const activeCwd = activeSession?.cwd ?? "~";
	const headerBranch = activeSession?.git?.branch ?? null;

	const homeDir = useHomeDir();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [gitPanelOpen, setGitPanelOpen] = useState(false);

	const { increaseFontSize, decreaseFontSize, appTheme } =
		useAppConfigStore();

	useApplyAppTheme(appThemeValue(appTheme));

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
			<RenameEntityDialog />
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
						cumulativeUsage={activeSession?.cumulativeUsage ?? null}
						lastTurnUsage={activeSession?.lastTurnUsage ?? null}
						claudeModel={activeSession?.claudeModel ?? null}
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
