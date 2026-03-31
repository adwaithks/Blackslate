import { useState } from "react";
import { IoAdd } from "react-icons/io5";
import {
	LuBrain,
	LuChevronDown,
	LuDot,
	LuFolder,
	LuHistory,
} from "react-icons/lu";
import { SiClaude } from "react-icons/si";
import {
	TbLayoutSidebarFilled,
	TbLayoutSidebarRightFilled,
} from "react-icons/tb";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClaudeModelSelect } from "@/components/header/ClaudeModelSelect";
import { ClaudeSessionPicker } from "@/components/header/ClaudeSessionPicker";
import { ClaudeSettingsSheet } from "@/components/header/ClaudeSettingsSheet";
import {
	HEADER_REPO_ICON,
	HEADER_REPO_SEP,
	HEADER_REPO_TEXT,
} from "@/lib/headerRepoLineStyles";

interface AppTitlebarProps {
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
}

/**
 * macOS titlebar row: drag region, workspace controls, cwd, Claude menu, git toggle.
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
}: AppTitlebarProps) {
	const [claudeSettingsOpen, setClaudeSettingsOpen] = useState(false);
	const [claudeSessionsOpen, setClaudeSessionsOpen] = useState(false);

	return (
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

			<div
				className="@container/titlebar border-b border-white/4 flex min-w-0 w-full items-center gap-2 bg-background px-3"
			>
				<span
					data-tauri-drag-region
					title={
						headerBranch
							? `${headerPwd} · ${headerBranch}`
							: headerPwd
					}
					className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden text-xs leading-none select-none"
				>
					<LuFolder
						className={`size-3.5 shrink-0 ${HEADER_REPO_ICON}`}
						aria-hidden
					/>
					<span
						className={`min-w-0 max-w-[35cqw] shrink truncate ${HEADER_REPO_TEXT}`}
					>
						{headerPwd}
					</span>
					{headerBranch ? (
						<>
							<LuDot
								className={`size-2.5 shrink-0 ${HEADER_REPO_SEP}`}
								aria-hidden
							/>
							<span
								className={`min-w-0 shrink truncate ${HEADER_REPO_TEXT}`}
							>
								{headerBranch}
							</span>
						</>
					) : null}
				</span>
				{/* WKWebKit only applies drag to nodes with the attribute; an empty flex-1 strip restores window drag in the gap. */}
				<div
					className="min-h-8 min-w-0 flex-1 self-stretch"
					data-tauri-drag-region
					aria-hidden
				/>
				<div
					className="flex shrink-0 items-center gap-1"
					data-tauri-drag-region="false"
				>
					<ClaudeModelSelect />
					<DropdownMenu>
						<DropdownMenuTrigger
							type="button"
							className="inline-flex h-6.5 shrink-0 items-center gap-1 rounded-sm border border-white/6 bg-white/3 px-2 py-0.5 text-[10px] font-medium text-[#D97757]/90 outline-none transition-colors hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-ring/40"
							aria-label="Claude menu"
						>
							<SiClaude
								className="size-3 shrink-0 text-[#D97757]"
								aria-hidden
							/>
							<span className="leading-none">Claude</span>
							<LuChevronDown
								className="size-3 shrink-0 opacity-60"
								aria-hidden
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="min-w-[9rem]"
						>
							<DropdownMenuItem
								className="gap-2 text-xs"
								onClick={() => setClaudeSettingsOpen(true)}
							>
								<LuBrain
									className="size-3 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								Config
							</DropdownMenuItem>
							<DropdownMenuItem
								className="gap-2 text-xs"
								onClick={() => setClaudeSessionsOpen(true)}
							>
								<LuHistory
									className="size-3 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								Sessions
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<ClaudeSettingsSheet
						open={claudeSettingsOpen}
						onOpenChange={setClaudeSettingsOpen}
					/>
					<ClaudeSessionPicker
						cwd={headerPwd}
						open={claudeSessionsOpen}
						onOpenChange={setClaudeSessionsOpen}
						trigger="menu"
					/>

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
