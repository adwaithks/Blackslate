import { useEffect, useState } from "react";
import { IoAdd } from "react-icons/io5";
import { LuFolder } from "react-icons/lu";
import { SiClaude } from "react-icons/si";
import {
	TbLayoutSidebarFilled,
	TbLayoutSidebarRightFilled,
} from "react-icons/tb";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { GitPanel } from "@/components/git/GitPanel";
import {
	cwdToAbsolute,
	selectActiveSession,
	useSessionStore,
} from "@/store/sessions";
import { useSettingsStore, SIDEBAR_COLOR_OPTIONS } from "@/store/settings";
import { getHomeDir } from "@/hooks/usePty";
import {
	modBracketKey,
	modDigitKey,
	modLetter,
	modOptionDigitKey,
	useAppShortcuts,
	zoomInKeys,
	zoomOutKey,
} from "@/lib/appShortcuts";
import { ClaudeSessionPicker } from "@/components/header/ClaudeSessionPicker";
import { ClaudeSettingsSheet } from "@/components/header/ClaudeSettingsSheet";

export function AppLayout() {
	const { workspaces, activeWorkspaceId, createWorkspace } =
		useSessionStore();
	const activeCwd =
		selectActiveSession({ workspaces, activeWorkspaceId })?.cwd ?? "~";

	const [homeDir, setHomeDir] = useState<string>("");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [gitPanelOpen, setGitPanelOpen] = useState(false);

	const { increaseFontSize, decreaseFontSize, sidebarColor } =
		useSettingsStore();
	const sidebarColorValue =
		SIDEBAR_COLOR_OPTIONS.find((o) => o.id === sidebarColor)?.value ??
		SIDEBAR_COLOR_OPTIONS[0].value;

	useEffect(() => {
		document.documentElement.style.setProperty(
			"--chrome-sidebar-surface",
			sidebarColorValue,
		);
	}, [sidebarColorValue]);

	useEffect(() => {
		getHomeDir()
			.then(setHomeDir)
			.catch(() => setHomeDir(""));
	}, []);

	const headerPwd = homeDir ? cwdToAbsolute(activeCwd, homeDir) : activeCwd;

	const buildShortcuts = () => {
		// ⌘1–9: switch to workspace N (sidebar order)
		const gotoWorkspaceShortcuts = Array.from({ length: 9 }, (_, i) => {
			const n = i + 1;
			return {
				id: `goto-workspace-${n}`,
				when: (e: KeyboardEvent) => modDigitKey(e) === n,
				run: () => {
					const s = useSessionStore.getState();
					const ws = s.workspaces[n - 1];
					if (ws) s.activateWorkspace(ws.id);
				},
			};
		});

		// ⌘⌥1–9: switch to session tab N within the active workspace (horizontal tabs)
		const gotoTabShortcuts = Array.from({ length: 9 }, (_, i) => {
			const n = i + 1;
			return {
				id: `goto-tab-${n}`,
				when: (e: KeyboardEvent) => modOptionDigitKey(e) === n,
				run: () => {
					const s = useSessionStore.getState();
					const ws = s.workspaces.find(
						(w) => w.id === s.activeWorkspaceId,
					);
					if (!ws) return;
					const target = ws.sessions[n - 1];
					if (target) s.activateSession(ws.id, target.id);
				},
			};
		});

		return [
			...gotoWorkspaceShortcuts,
			...gotoTabShortcuts,
			{
				// ⌘N — new workspace (new sidebar row + first tab)
				id: "new-workspace",
				when: (e: KeyboardEvent) => modLetter(e, "n"),
				run: () => useSessionStore.getState().createWorkspace(),
			},
			{
				// ⌘T — new tab within the active workspace
				id: "new-tab",
				when: (e: KeyboardEvent) => modLetter(e, "t"),
				run: () => {
					const s = useSessionStore.getState();
					s.createSessionInWorkspace(s.activeWorkspaceId);
				},
			},
			{
				// ⌘W / ⌘Q — close active tab (or workspace if it's the last tab)
				id: "close-tab",
				when: (e: KeyboardEvent) =>
					modLetter(e, "w") || modLetter(e, "q"),
				run: () => {
					const s = useSessionStore.getState();
					const ws = s.workspaces.find(
						(w) => w.id === s.activeWorkspaceId,
					);
					if (ws) s.closeSession(ws.id, ws.activeSessionId);
				},
			},
			{
				id: "toggle-sidebar",
				when: (e: KeyboardEvent) => modLetter(e, "b"),
				run: () => setSidebarOpen((o) => !o),
			},
			{
				// ⌘L — toggle git panel (same as Chrome “focus address bar” — here: repo UI)
				id: "toggle-git-panel",
				when: (e: KeyboardEvent) => modLetter(e, "l"),
				run: () => setGitPanelOpen((o) => !o),
			},
			{
				// ⌘[ / ⌘] — previous / next session tab (same as Safari/Chrome tabs)
				id: "tab-prev",
				when: (e: KeyboardEvent) => modBracketKey(e, "left"),
				run: () => {
					const s = useSessionStore.getState();
					const ws = s.workspaces.find(
						(w) => w.id === s.activeWorkspaceId,
					);
					if (!ws || ws.sessions.length === 0) return;
					const i = ws.sessions.findIndex(
						(sess) => sess.id === ws.activeSessionId,
					);
					if (i < 0) return;
					const prev =
						(i - 1 + ws.sessions.length) % ws.sessions.length;
					s.activateSession(ws.id, ws.sessions[prev].id);
				},
			},
			{
				id: "tab-next",
				when: (e: KeyboardEvent) => modBracketKey(e, "right"),
				run: () => {
					const s = useSessionStore.getState();
					const ws = s.workspaces.find(
						(w) => w.id === s.activeWorkspaceId,
					);
					if (!ws || ws.sessions.length === 0) return;
					const i = ws.sessions.findIndex(
						(sess) => sess.id === ws.activeSessionId,
					);
					if (i < 0) return;
					const next = (i + 1) % ws.sessions.length;
					s.activateSession(ws.id, ws.sessions[next].id);
				},
			},
			{
				id: "zoom-in",
				when: (e: KeyboardEvent) => zoomInKeys(e),
				run: () => increaseFontSize(),
			},
			{
				id: "zoom-out",
				when: (e: KeyboardEvent) => zoomOutKey(e),
				run: () => decreaseFontSize(),
			},
		];
	};

	useAppShortcuts(buildShortcuts);

	return (
		<>
			<SettingsDialog />
			<SidebarProvider
				open={sidebarOpen}
				onOpenChange={setSidebarOpen}
				style={{ "--sidebar-width": "270px" } as React.CSSProperties}
			>
				<div className="flex flex-col h-screen w-screen overflow-hidden border-b-2">
					{/* Titlebar */}
					<div
						className="relative z-20 grid h-[34px] shrink-0"
						style={{
							gridTemplateColumns: sidebarOpen
								? "var(--sidebar-width) minmax(0, 1fr)"
								: "minmax(76px, auto) minmax(0, 1fr)",
						}}
					>
						<div
							data-tauri-drag-region
							className="flex min-w-0 items-center justify-end gap-0.5 bg-[var(--chrome-sidebar-surface)] pl-[76px] pr-2"
						>
							<Button
								variant="ghost"
								size="sm"
								onClick={createWorkspace}
								className="h-6 shrink-0 px-1 text-muted-foreground rounded-sm"
								title="New workspace (⌘N)"
							>
								<IoAdd className="size-5 shrink-0" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setSidebarOpen((o) => !o)}
								aria-label={
									sidebarOpen
										? "Hide sidebar"
										: "Show sidebar"
								}
								aria-pressed={sidebarOpen}
								className="h-6 w-6 shrink-0 px-1 text-muted-foreground hover:text-foreground"
							>
								{sidebarOpen ? (
									<TbLayoutSidebarFilled
										className="size-4.5 shrink-0"
										aria-hidden
									/>
								) : (
									<TbLayoutSidebarRightFilled
										className="size-4.5 shrink-0"
										aria-hidden
									/>
								)}
							</Button>
						</div>
						<div
							data-tauri-drag-region
							className="border-b border-white/4 flex min-w-0 w-full items-center justify-between bg-background px-3"
						>
							<span
								title={headerPwd}
								className="flex min-w-0 items-center gap-1.5 text-xs leading-none text-muted-foreground/50 select-none"
							>
								<LuFolder
									className="size-3.5 shrink-0 text-muted-foreground/45"
									aria-hidden
								/>
								<span className="min-w-0 flex-1 truncate">
									{headerPwd}
								</span>
							</span>
							<div className="flex shrink-0 items-center gap-1">
								<div className="mr-2 h-6.5 flex items-center rounded-sm border border-white/6 bg-white/3">
									<div className="flex items-center gap-1 px-1.5 py-0.5 border-r border-white/6">
										<SiClaude
											className="text-[#D97757] size-3 shrink-0"
											aria-hidden
										/>
										<span className="text-[10px] font-medium text-[#D97757]/80 leading-none">
											Claude
										</span>
									</div>
									<ClaudeSettingsSheet />
									<ClaudeSessionPicker cwd={headerPwd} />
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setGitPanelOpen((o) => !o)}
									title="Toggle git panel (⌘L)"
									aria-label={
										gitPanelOpen
											? "Hide git panel"
											: "Show git panel"
									}
									aria-pressed={gitPanelOpen}
									className="h-6 w-6 shrink-0 px-1 text-muted-foreground hover:text-foreground"
								>
									{gitPanelOpen ? (
										<TbLayoutSidebarRightFilled
											className="size-4.5 shrink-0"
											aria-hidden
										/>
									) : (
										<TbLayoutSidebarFilled
											className="size-4.5 shrink-0"
											aria-hidden
										/>
									)}
								</Button>
							</div>
						</div>
					</div>

					{/* Main content: sidebar + terminal + git panel */}
					<div className="flex flex-1 min-h-0 min-w-0">
						<AppSidebar />
						<main className="flex-1 overflow-hidden min-w-0">
							<TerminalView />
						</main>
						<GitPanel
							open={gitPanelOpen}
							activeCwd={
								homeDir
									? cwdToAbsolute(activeCwd, homeDir)
									: activeCwd
							}
						/>
					</div>
				</div>
			</SidebarProvider>
		</>
	);
}
