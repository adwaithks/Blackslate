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

// Signature that changes when terminal layout, active state, or git info (branch/root) changes.
function selectCommitStackSignature(state: TerminalsState): string {
	return buildMountedTerminalRows(state)
		.map(({ terminalId, isActive }) => {
			const term = findTerminal(state.workspaces, terminalId);
			const g = term?.git;
			return `${terminalId}:${isActive ? "1" : "0"}:${g?.root ?? ""}:${g?.branch ?? ""}`;
		})
		.join("|");
}

// One commit button per unique (gitRoot + branch), kept alive so state survives tab switches.
// Only the active terminal's button is visible; inactive ones return null from render.
// Terminals on the same branch in the same repo share one button instance and one commit flow.
function CommitButtonStack() {
	const stackSignature = useTerminalStore(selectCommitStackSignature);
	const rows = useMemo(() => {
		const state = useTerminalStore.getState();
		const mounted = buildMountedTerminalRows(state);

		// Key = "gitRoot::branch". Fall back to terminalId until git info loads
		// so terminals stay isolated rather than accidentally collapsing.
		const byKey = new Map<string, { cwd: string; branch: string; repoName: string; isWorktree: boolean; isActive: boolean }>();
		for (const { terminalId, isActive } of mounted) {
			const term = findTerminal(state.workspaces, terminalId);
			if (!term) continue;
			const key = term.git ? `${term.git.root}::${term.git.branch}` : terminalId;
			const branch = term.git?.branch ?? "";
			const rootParts = term.git?.root.split("/").filter(Boolean) ?? [];
			const repoName = rootParts[rootParts.length - 1] ?? "";
			const isWorktree = term.git?.isWorktree ?? false;
			const prev = byKey.get(key);
			byKey.set(key, {
				cwd: isActive ? term.cwd : (prev?.cwd ?? term.cwd),
				branch: branch || prev?.branch || "",
				repoName: repoName || prev?.repoName || "",
				isWorktree: isWorktree || prev?.isWorktree || false,
				isActive: (prev?.isActive ?? false) || isActive,
			});
		}

		return Array.from(byKey.entries()).map(([key, { cwd, branch, repoName, isWorktree, isActive }]) => ({
			key,
			cwd,
			branch,
			repoName,
			isWorktree,
			isActive,
		}));
	}, [stackSignature]);

	return (
		<>
			{rows.map(({ key, cwd, branch, repoName, isWorktree, isActive }) => (
				<TitlebarCommitButton
					key={key}
					cwd={cwd}
					branch={branch}
					repoName={repoName}
					isWorktree={isWorktree}
					hidden={!isActive}
				/>
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
