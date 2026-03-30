import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TbMinus, TbPlus } from "react-icons/tb";
import type { GitStatus } from "@/components/git/gitTypes";
import { GitFileRow } from "@/components/git/GitFileRow";

interface RepoTabsProps {
	status: GitStatus;
	activeTab: "changes" | "staged";
	onTabChange: (t: "changes" | "staged") => void;
	act: (cmd: string, args?: Record<string, string>) => Promise<void>;
}

export function RepoTabs({
	status,
	activeTab,
	onTabChange,
	act,
}: RepoTabsProps) {
	const totalUnstaged = status.unstaged.length;
	const totalStaged = status.staged.length;

	const showStageAll = activeTab === "changes" && totalUnstaged > 0;
	const showDiscardAll = activeTab === "changes" && totalUnstaged > 0;
	const showUnstageAll = activeTab === "staged" && totalStaged > 0;

	return (
		<Tabs
			value={activeTab}
			onValueChange={(v) => onTabChange(v as "changes" | "staged")}
			className="flex flex-col min-h-0"
		>
			{/* Fixed-width action rail so switching tabs does not jump the toolbar */}
			<div className="flex shrink-0 items-center border-b border-border/20 min-w-0">
				<TabsList
					variant="line"
					className="h-7 min-h-7 flex-1 min-w-0 rounded-none bg-transparent border-0 px-2 justify-start gap-0"
				>
					<TabsTrigger
						value="changes"
						className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
					>
						Changes
						{totalUnstaged > 0 && (
							<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
								{totalUnstaged}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger
						value="staged"
						className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-muted/50 data-[state=active]:text-foreground text-muted-foreground"
					>
						Staged
						{totalStaged > 0 && (
							<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
								{totalStaged}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				<div className="flex h-7 shrink-0 items-center justify-end gap-0.5 pr-2 pl-1">
					<div className="flex w-[50px] shrink-0 items-center justify-end gap-0.5">
						<div className="flex size-6 shrink-0 items-center justify-center">
							{showStageAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("stage_all")}
									className="size-6 p-0 text-muted-foreground hover:text-foreground"
									title="Stage all changes"
								>
									<TbPlus className="size-3.5" />
								</Button>
							) : null}
						</div>
						<div className="flex size-6 shrink-0 items-center justify-center">
							{showDiscardAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("discard_all")}
									className="size-6 p-0 text-muted-foreground hover:text-destructive"
									title="Discard all unstaged changes"
								>
									<TbMinus className="size-3.5" />
								</Button>
							) : showUnstageAll ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => act("unstage_all")}
									className="size-6 p-0 text-muted-foreground hover:text-foreground"
									title="Unstage all files"
								>
									<TbMinus className="size-3.5" />
								</Button>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<TabsContent value="changes" className="mt-0">
				{status.unstaged.length === 0 ? (
					<p className="px-3 py-3 text-xs text-muted-foreground/35">
						No unstaged changes
					</p>
				) : (
					status.unstaged.map((f) => (
						<GitFileRow
							key={f.path}
							file={f}
							actions={[
								{
									icon: <TbPlus className="size-3.5" />,
									label: "Stage file",
									onClick: () =>
										act("stage_file", { path: f.path }),
								},
								{
									icon: <TbMinus className="size-3.5" />,
									label: "Discard changes",
									danger: true,
									onClick: () =>
										act("discard_file", { path: f.path }),
								},
							]}
						/>
					))
				)}
			</TabsContent>

			<TabsContent value="staged" className="mt-0">
				{status.staged.length === 0 ? (
					<p className="px-3 py-3 text-xs text-muted-foreground/35">
						No staged changes
					</p>
				) : (
					status.staged.map((f) => (
						<GitFileRow
							key={f.path}
							file={f}
							actions={[
								{
									icon: <TbMinus className="size-3.5" />,
									label: "Unstage file",
									onClick: () =>
										act("unstage_file", { path: f.path }),
								},
							]}
						/>
					))
				)}
			</TabsContent>
		</Tabs>
	);
}
