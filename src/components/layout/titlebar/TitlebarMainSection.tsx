import { useShallow } from "zustand/react/shallow";
import { TitlebarCwdBranchLine } from "@/components/layout/titlebar/TitlebarCwdBranchLine";
import { TitlebarClaudeMenu } from "@/components/layout/titlebar/TitlebarClaudeMenu";
import { TitlebarCommitButton } from "@/components/layout/titlebar/TitlebarCommitButton";
import { TitlebarGitPanelToggle } from "@/components/layout/titlebar/TitlebarGitPanelToggle";
import { WikiFilePicker } from "@/components/wiki/WikiFilePicker";
import { selectActiveTerminal, useTerminalStore } from "@/store/terminals";

export interface TitlebarMainSectionProps {
	headerPwd: string;
	headerBranch: string | null;
	gitPanelOpen: boolean;
	onToggleGitPanel: () => void;
}

// Middle of the top bar: folder line, empty strip you can drag to move the window, Claude and wiki controls, git toggle.
export function TitlebarMainSection({
	headerPwd,
	headerBranch,
	gitPanelOpen,
	onToggleGitPanel,
}: TitlebarMainSectionProps) {
	const { repoName, isWorktree } = useTerminalStore(
		useShallow((s) => {
			const term = selectActiveTerminal(s);
			const root = term?.git?.root ?? "";
			const parts = root.split("/").filter(Boolean);
			return {
				repoName: parts[parts.length - 1] ?? "",
				isWorktree: term?.git?.isWorktree ?? false,
			};
		}),
	);

	return (
		<div className="@container/titlebar flex min-w-0 w-full items-center gap-2 border-b border-border bg-background px-3">
			<TitlebarCwdBranchLine cwd={headerPwd} branch={headerBranch} />
			{/* Empty stretch so you can drag the window in the gap; marked so the system treats it as draggable. */}
			<div
				className="min-h-8 min-w-0 flex-1 self-stretch"
				data-tauri-drag-region
				aria-hidden
			/>
			<div
				className="flex shrink-0 items-center gap-1"
				data-tauri-drag-region="false"
			>
				<TitlebarCommitButton
					cwd={headerPwd}
					branch={headerBranch ?? undefined}
					repoName={repoName}
					isWorktree={isWorktree}
				/>
				<WikiFilePicker cwd={headerPwd} />
				<TitlebarClaudeMenu cwd={headerPwd} />
				<TitlebarGitPanelToggle
					open={gitPanelOpen}
					onToggle={onToggleGitPanel}
				/>
			</div>
		</div>
	);
}
