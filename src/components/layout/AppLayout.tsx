import { useEffect, useState } from "react";
import { IoAdd } from "react-icons/io5";
import { LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { cwdToAbsolute, useSessionStore } from "@/store/sessions";
import { useSettingsStore } from "@/store/settings";
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

	const { increaseFontSize, decreaseFontSize } = useSettingsStore();

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
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={setSidebarOpen}
			style={{ "--sidebar-width": "270px" } as React.CSSProperties}
		>
			<div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent">
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
						className="flex min-w-0 items-center justify-end gap-0.5 bg-[var(--slate-sidebar-surface)] pl-[76px] pr-2"
					>
						<Button
							variant="ghost"
							size="sm"
							onClick={createSession}
							className="h-6 shrink-0 p-1 px-2 text-muted-foreground hover:text-foreground"
						>
							<IoAdd className="size-3.5 shrink-0" />
							{sidebarOpen ? "New Tab" : null}
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
							className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
						>
							{sidebarOpen ? (
								<LuPanelLeftClose
									className="size-3.5 shrink-0"
									aria-hidden
								/>
							) : (
								<LuPanelLeftOpen
									className="size-3.5 shrink-0"
									aria-hidden
								/>
							)}
						</Button>
					</div>
					<div
						data-tauri-drag-region
						className="flex min-w-0 w-full items-center justify-start bg-[#000000] px-3"
					>
						<span
							title={headerPwd}
							className="min-w-0 truncate text-xs leading-none text-muted-foreground/50 select-none"
						>
							{headerPwd}
						</span>
					</div>
				</div>

				{/* Main content: sidebar + terminal */}
				<div className="flex flex-1 min-h-0 min-w-0">
					<AppSidebar />
					<main className="flex-1 overflow-hidden bg-background min-w-0">
						<TerminalView />
					</main>
				</div>
			</div>
		</SidebarProvider>
	);
}
