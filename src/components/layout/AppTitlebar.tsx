import { IoAdd } from "react-icons/io5";
import { LuFolder } from "react-icons/lu";
import { SiClaude } from "react-icons/si";
import {
	TbLayoutSidebarFilled,
	TbLayoutSidebarRightFilled,
} from "react-icons/tb";
import { Button } from "@/components/ui/button";
import { ClaudeSessionPicker } from "@/components/header/ClaudeSessionPicker";
import { ClaudeSettingsSheet } from "@/components/header/ClaudeSettingsSheet";

interface AppTitlebarProps {
	/** Whether the left sidebar column is expanded (drives titlebar grid + toggle icon). */
	sidebarOpen: boolean;
	/** Absolute cwd string for the path label and session picker. */
	headerPwd: string;
	onCreateWorkspace: () => void;
	onToggleSidebar: () => void;
	gitPanelOpen: boolean;
	onToggleGitPanel: () => void;
}

/**
 * macOS titlebar row: drag region, workspace controls, cwd, Claude pill, git toggle.
 * Grid columns align with the sidebar width below (see parent).
 */
export function AppTitlebar({
	sidebarOpen,
	headerPwd,
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
			{/* Left column: traffic-light padding + new workspace + sidebar toggle */}
			<div
				data-tauri-drag-region
				className="flex min-w-0 items-center justify-end gap-0.5 bg-[var(--chrome-sidebar-surface)] pl-[76px] pr-2"
			>
				<Button
					variant="ghost"
					size="sm"
					onClick={onCreateWorkspace}
					className="h-6 shrink-0 px-1 text-muted-foreground rounded-sm"
					title="New workspace (⌘N)"
				>
					<IoAdd className="size-5 shrink-0" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onToggleSidebar}
					aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
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

			{/* Right column: cwd + Claude config/session + git panel */}
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
					<span className="min-w-0 flex-1 truncate">{headerPwd}</span>
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
						onClick={onToggleGitPanel}
						title="Toggle git panel (⌘L)"
						aria-label={
							gitPanelOpen ? "Hide git panel" : "Show git panel"
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
	);
}
