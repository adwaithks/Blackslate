import { useMemo } from "react";
import { TitlebarCwdBranchLine } from "@/components/layout/titlebar/TitlebarCwdBranchLine";
import { TitlebarClaudeMenu } from "@/components/layout/titlebar/TitlebarClaudeMenu";
import { TitlebarCommitButton } from "@/components/layout/titlebar/TitlebarCommitButton";
import { TitlebarGitPanelToggle } from "@/components/layout/titlebar/TitlebarGitPanelToggle";
import { WikiFilePicker } from "@/components/wiki/WikiFilePicker";
import {
	useTerminalStore,
	buildMountedTerminalRows,
	findTerminal,
	selectTerminalStackSignature,
} from "@/store/terminals";

// One commit button per mounted terminal, kept alive so state survives tab switches.
// Only the active terminal's button is visible; inactive ones are hidden with display:none.
function CommitButtonStack() {
	const stackSignature = useTerminalStore(selectTerminalStackSignature);
	const rows = useMemo(() => {
		const state = useTerminalStore.getState();
		return buildMountedTerminalRows(state).map(({ terminalId, isActive }) => ({
			terminalId,
			isActive,
			cwd: findTerminal(state.workspaces, terminalId)?.cwd ?? "~",
		}));
	}, [stackSignature]);

	return (
		<>
			{rows.map(({ terminalId, isActive, cwd }) => (
				<div
					key={terminalId}
					style={{ display: isActive ? undefined : "none" }}
				>
					<TitlebarCommitButton cwd={cwd} />
				</div>
			))}
		</>
	);
}

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
				<CommitButtonStack />
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
