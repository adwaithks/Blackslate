import { TitlebarCwdBranchLine } from "@/components/layout/titlebar/TitlebarCwdBranchLine";
import { TitlebarSessionUsageChip } from "@/components/layout/titlebar/TitlebarSessionUsageChip";
import { TitlebarContextUsageChip } from "@/components/layout/titlebar/TitlebarContextUsageChip";
import { TitlebarClaudeMenu } from "@/components/layout/titlebar/TitlebarClaudeMenu";
import { TitlebarGitPanelToggle } from "@/components/layout/titlebar/TitlebarGitPanelToggle";
import type { TurnUsage } from "@/store/sessions";

export interface TitlebarMainSectionProps {
	headerPwd: string;
	headerBranch: string | null;
	claudeModel: string | null;
	gitPanelOpen: boolean;
	onToggleGitPanel: () => void;
	cumulativeUsage: TurnUsage | null;
	lastTurnUsage: TurnUsage | null;
}

/**
 * Titlebar grid cell above the main content: cwd/repo line, drag strip, session usage, Claude menus, git panel.
 */
export function TitlebarMainSection({
	headerPwd,
	headerBranch,
	claudeModel,
	gitPanelOpen,
	onToggleGitPanel,
	cumulativeUsage,
	lastTurnUsage,
}: TitlebarMainSectionProps) {
	return (
		<div className="@container/titlebar flex min-w-0 w-full items-center gap-2 border-b border-border bg-background px-3">
			<TitlebarCwdBranchLine cwd={headerPwd} branch={headerBranch} />
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
				<TitlebarContextUsageChip
					claudeModel={claudeModel}
					lastTurnUsage={lastTurnUsage}
				/>
				<TitlebarSessionUsageChip
					cumulativeUsage={cumulativeUsage}
					lastTurnUsage={lastTurnUsage}
				/>
				<TitlebarClaudeMenu cwd={headerPwd} />
				<TitlebarGitPanelToggle
					open={gitPanelOpen}
					onToggle={onToggleGitPanel}
				/>
			</div>
		</div>
	);
}
