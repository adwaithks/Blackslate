import { useEffect, useState } from "react";
import { IoAdd } from "react-icons/io5";
import { LuFolder } from "react-icons/lu";
import { TbLayoutSidebarFilled, TbLayoutSidebarRightFilled } from "react-icons/tb";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { GitPanel } from "@/components/git/GitPanel";
import { cwdToAbsolute, useSessionStore } from "@/store/sessions";
import { useSettingsStore, SIDEBAR_COLOR_OPTIONS } from "@/store/settings";
import { getHomeDir } from "@/hooks/usePty";
import {
	modDigitKey,
	modLetter,
	useAppShortcuts,
	zoomInKeys,
	zoomOutKey,
} from "@/lib/appShortcuts";
export function AppLayout() {
	const { sessions, activeId, createSession } = useSessionStore();
	const activeCwd = sessions.find((s) => s.id === activeId)?.cwd ?? "~";
	const [homeDir, setHomeDir] = useState<string>("");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [gitPanelOpen, setGitPanelOpen] = useState(false);

	const { increaseFontSize, decreaseFontSize, sidebarColor } = useSettingsStore();
	const sidebarColorValue =
		SIDEBAR_COLOR_OPTIONS.find((o) => o.id === sidebarColor)?.value ??
		SIDEBAR_COLOR_OPTIONS[0].value;

	// Keep CSS custom property in sync with store — used by sidebar + titlebar strip
	useEffect(() => {
		document.documentElement.style.setProperty(
			"--chrome-sidebar-surface",
			sidebarColorValue,
		);
	}, [sidebarColorValue]);

	useEffect(() => {
		getHomeDir().then(setHomeDir).catch(() => setHomeDir(""));
	}, []);

	const headerPwd = homeDir ? cwdToAbsolute(activeCwd, homeDir) : activeCwd;

	const buildShortcuts = () => {
		const session = useSessionStore.getState();
		const gotoTabShortcuts = Array.from({ length: 9 }, (_, i) => {
			const n = i + 1;
			return {
				id: `goto-tab-${n}`,
				when: (e: KeyboardEvent) => modDigitKey(e) === n,
				run: () => {
					const s = useSessionStore.getState();
					const target = s.sessions[n - 1];
					if (target) s.activateSession(target.id);
				},
			};
		});
		return [
			...gotoTabShortcuts,
			{
				id: "new-tab",
				when: (e: KeyboardEvent) => modLetter(e, "n"),
				run: () => session.createSession(),
			},
			{
				id: "close-tab",
				when: (e: KeyboardEvent) => modLetter(e, "q"),
				run: () => session.closeSession(session.activeId),
			},
			{
				id: "close-tab-alt",
				when: (e: KeyboardEvent) => modLetter(e, "w"),
				run: () => session.closeSession(session.activeId),
			},
			{
				id: "toggle-sidebar",
				when: (e: KeyboardEvent) => modLetter(e, "b"),
				run: () => setSidebarOpen((o) => !o),
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
			<div className="flex flex-col h-screen w-screen overflow-hidden">
				{/* macOS titlebar — sidebar column: traffic-light clearance + New Tab (same row as controls); cwd on the right */}
				<div
					className="relative z-20 grid h-[32px] shrink-0"
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
							onClick={createSession}
							className="h-6 shrink-0 px-1 text-muted-foreground rounded-sm"
						>
							<IoAdd className="size-5 shrink-0" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen((o) => !o)}
							aria-label={
								sidebarOpen ? "Hide sidebar" : "Show sidebar"
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
						className="flex min-w-0 w-full items-center justify-between bg-black px-3"
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
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setGitPanelOpen((o) => !o)}
							aria-label={gitPanelOpen ? "Hide git panel" : "Show git panel"}
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
