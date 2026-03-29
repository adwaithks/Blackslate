import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IoAdd } from "react-icons/io5";
import {
	LuFolder,
	LuPanelLeftClose,
	LuPanelLeftOpen,
	LuCode,
} from "react-icons/lu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { EditorView } from "@/components/editor/EditorView";
import { cwdToAbsolute, useSessionStore } from "@/store/sessions";
import {
	useSettingsStore,
	SIDEBAR_COLOR_OPTIONS,
	DEFAULT_SIDEBAR_WIDTH,
	DEFAULT_EDITOR_PANEL_WIDTH,
} from "@/store/settings";
import { useEditorStore } from "@/store/editor";
import { usePanelResize } from "@/hooks/usePanelResize";
import { getHomeDir } from "@/hooks/usePty";
import {
	isCmEditorFocused,
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

	const {
		increaseFontSize,
		decreaseFontSize,
		sidebarColor,
		sidebarWidth: persistedSidebarWidth,
		editorPanelWidth: persistedEditorPanelWidth,
		setSidebarWidth,
		setEditorPanelWidth,
	} = useSettingsStore();

	const { width: sidebarWidth, startDrag: startSidebarDrag } = usePanelResize({
		initialWidth: persistedSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
		min: 160,
		max: 480,
		direction: 1,
		onEnd: setSidebarWidth,
	});

	const { width: editorPanelWidth, startDrag: startEditorDrag } = usePanelResize({
		initialWidth: persistedEditorPanelWidth ?? DEFAULT_EDITOR_PANEL_WIDTH,
		min: 320,
		max: 1200,
		direction: -1,
		onEnd: setEditorPanelWidth,
	});
	const sidebarColorValue =
		SIDEBAR_COLOR_OPTIONS.find((o) => o.id === sidebarColor)?.value ??
		SIDEBAR_COLOR_OPTIONS[0].value;

	const { toggleEditor, isOpen: editorOpen, setRootPath } = useEditorStore();

	// Keep CSS custom property in sync with store — used by sidebar + titlebar strip
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

	// Sync active session's cwd → editor root path
	useEffect(() => {
		if (!homeDir) return;
		const absPath = cwdToAbsolute(activeCwd, homeDir);
		setRootPath(absPath);
	}, [activeCwd, homeDir, setRootPath]);

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
				run: () => {
					// ⌘W: if editor is focused, close the active file tab; else close terminal session
					if (isCmEditorFocused()) {
						const { activeFilePath, closeFile } =
							useEditorStore.getState();
						if (activeFilePath) closeFile(activeFilePath);
					} else {
						session.closeSession(session.activeId);
					}
				},
			},
			{
				id: "toggle-sidebar",
				when: (e: KeyboardEvent) => modLetter(e, "b"),
				run: () => setSidebarOpen((o) => !o),
			},
			{
				id: "toggle-editor",
				when: (e: KeyboardEvent) => modLetter(e, "e"),
				run: () => toggleEditor(),
			},
			{
				id: "save-file",
				when: (e: KeyboardEvent) => modLetter(e, "s"),
				run: () => {
					const { openFiles, activeFilePath, markFileSaved } =
						useEditorStore.getState();
					const file = openFiles.find(
						(f) => f.path === activeFilePath,
					);
					if (!file || !file.isDirty) return;
					invoke("fs_write_file", {
						path: file.path,
						content: file.content,
					})
						.then(() => markFileSaved(file.path))
						.catch(console.error);
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
				style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
			>
				<div className="flex flex-col h-screen w-screen overflow-hidden">
					{/* macOS titlebar */}
					<div
						className="relative z-20 grid h-[32px] shrink-0"
						style={{
							gridTemplateColumns: editorOpen
								? sidebarOpen
									? `var(--sidebar-width) minmax(0, 1fr) ${editorPanelWidth}px`
									: `minmax(76px, auto) minmax(0, 1fr) ${editorPanelWidth}px`
								: sidebarOpen
									? "var(--sidebar-width) minmax(0, 1fr)"
									: "minmax(76px, auto) minmax(0, 1fr)",
						}}
					>
						{/* Col 1 — session sidebar chrome */}
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
									sidebarOpen
										? "Hide sidebar"
										: "Show sidebar"
								}
								aria-pressed={sidebarOpen}
								className="h-6 w-6 shrink-0 px-1 text-muted-foreground hover:text-foreground"
							>
								{sidebarOpen ? (
									<LuPanelLeftClose
										className="size-4.5 shrink-0"
										aria-hidden
									/>
								) : (
									<LuPanelLeftOpen
										className="size-4.5 shrink-0"
										aria-hidden
									/>
								)}
							</Button>
						</div>

						{/* Col 2 — terminal cwd strip */}
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

							{/* Editor toggle — only visible here when the panel is closed */}
							{!editorOpen && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={toggleEditor}
									aria-label="Show editor"
									className="h-6 w-6 shrink-0 px-1 rounded-sm text-muted-foreground/30 hover:text-muted-foreground transition-colors"
								>
									<LuCode
										className="size-3.5 shrink-0"
										aria-hidden
									/>
								</Button>
							)}
						</div>

						{/* Col 3 — editor panel chrome (only rendered when editor is open) */}
						{editorOpen && (
							<div
								data-tauri-drag-region
								className="flex min-w-0 items-center justify-end px-2 border-border"
								style={{
									backgroundColor:
										"var(--chrome-sidebar-surface)",
								}}
							>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={toggleEditor}
									aria-label="Hide editor"
									className="h-6 w-6 shrink-0 px-1 rounded-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
								>
									<LuCode
										className="size-3.5 shrink-0"
										aria-hidden
									/>
								</Button>
							</div>
						)}
					</div>

					{/* Main content: session sidebar | terminal | code editor */}
					<div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
						<AppSidebar />
						{/* Handle 1: sidebar ↔ terminal */}
						{sidebarOpen && (
							<div
								className="w-1 shrink-0 cursor-col-resize hover:bg-border/60 active:bg-border transition-colors z-10"
								onMouseDown={startSidebarDrag}
							/>
						)}
						<main className="flex flex-1 overflow-hidden min-w-0">
							<div className="flex-1 overflow-hidden min-w-0">
								<TerminalView />
							</div>
							{/* Handle 3: terminal ↔ editor */}
							{editorOpen && (
								<div
									className="w-1 shrink-0 cursor-col-resize hover:bg-border/60 active:bg-border transition-colors z-10"
									onMouseDown={startEditorDrag}
								/>
							)}
							<EditorView editorPanelWidth={editorPanelWidth} />
						</main>
					</div>
				</div>
			</SidebarProvider>
		</>
	);
}
