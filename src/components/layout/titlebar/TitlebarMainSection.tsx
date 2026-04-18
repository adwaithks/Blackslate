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
} from "@/store/terminals";
import type { TerminalsState } from "@/store/terminals";

// Signature that changes when terminal layout, active state, OR any branch changes.
// selectTerminalStackSignature omits git info, so we build our own here.
function selectCommitStackSignature(state: TerminalsState): string {
	return buildMountedTerminalRows(state)
		.map(({ terminalId, isActive }) => {
			const term = findTerminal(state.workspaces, terminalId);
			return `${terminalId}:${isActive ? "1" : "0"}:${term?.git?.branch ?? ""}:${term?.cwd ?? ""}`;
		})
		.join("|");
}

// One commit button per unique branch, kept alive so state survives tab switches.
// Only the active branch's button is visible; inactive ones are hidden with display:none.
// Terminals on the same branch share one button instance (and therefore one commit flow).
function CommitButtonStack() {
	const stackSignature = useTerminalStore(selectCommitStackSignature);
	const rows = useMemo(() => {
		const state = useTerminalStore.getState();
		const mounted = buildMountedTerminalRows(state);

		// Collapse by branch: each unique branch gets one entry.
		// The active terminal's cwd wins so git operations target the right repo.
		// Fall back to terminalId when branch isn't known yet so each terminal
		// stays isolated until git info loads (avoids false sharing on same cwd).
		const byBranch = new Map<string, { cwd: string; isActive: boolean }>();
		for (const { terminalId, isActive } of mounted) {
			const term = findTerminal(state.workspaces, terminalId);
			if (!term) continue;
			const key = term.git?.branch ?? terminalId;
			const prev = byBranch.get(key);
			byBranch.set(key, {
				cwd: isActive ? term.cwd : (prev?.cwd ?? term.cwd),
				isActive: (prev?.isActive ?? false) || isActive,
			});
		}

		return Array.from(byBranch.entries()).map(([branch, { cwd, isActive }]) => ({
			branch,
			cwd,
			isActive,
		}));
	}, [stackSignature]);

	return (
		<>
			{rows.map(({ branch, cwd, isActive }) => (
				<div
					key={branch}
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
