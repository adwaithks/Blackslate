import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GitStatus } from "@/components/git/gitTypes";
import { sumLineStats } from "@/components/git/gitPanelHelpers";
import {
	TbFile,
	TbFolder,
	TbGitBranch,
	TbMinus,
	TbPlus,
	TbX,
} from "react-icons/tb";
import { DiffView, DiffModeEnum } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GitFileRow } from "@/components/git/GitFileRow";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { useIsLightTheme } from "@/hooks/useIsLightTheme";

type DiffMode = "head_to_worktree" | "head_to_index" | "index_to_worktree";

const GIT_DIFF_SIDEBAR_WIDTH_KEY = "git-diff-sidebar-width";
const GIT_DIFF_SIDEBAR_MIN_W = 220;
const GIT_DIFF_SIDEBAR_MAX_W = 520;
const GIT_DIFF_SIDEBAR_DEFAULT_W = 256;

type GitDiffBundle = {
	diff: string;
	oldContent: string;
	newContent: string;
};

type DiffTab = {
	id: string;
	path: string;
	mode: DiffMode;
	diff: string | null;
	/** Full file text for old/new sides — required for @git-diff-view context expansion. */
	oldContent: string | null;
	newContent: string | null;
	loading: boolean;
	error: string | null;
};

function filenameFromPath(path: string) {
	const segments = path.split("/");
	return segments[segments.length - 1] ?? path;
}

export function GitDiffViewerSheet({
	repoPath,
	repoDisplayName,
	branch,
	status,
	act,
	open,
	onOpenChange,
	pendingOpen,
	onConsumePendingOpen,
}: {
	repoPath: string;
	repoDisplayName: string;
	branch: string;
	status: GitStatus;
	act: (cmd: string, args?: Record<string, string>) => Promise<void>;
	open: boolean;
	onOpenChange: (v: boolean) => void;
	/** If set, the sheet will open this file (or focus its tab) once. */
	pendingOpen: { path: string; source: "changes" | "staged" } | null;
	onConsumePendingOpen: () => void;
}) {
	const isLight = useIsLightTheme();
	const [tabs, setTabs] = useState<DiffTab[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [sidebarListTab, setSidebarListTab] = useState<"changes" | "staged">(
		"changes",
	);

	const closeTabById = (id: string) => {
		setTabs((prev) => {
			const idx = prev.findIndex((t) => t.id === id);
			const next = prev.filter((t) => t.id !== id);
			setActiveId((curr) => {
				if (curr !== id) return curr;
				return (
					next[Math.max(0, idx - 1)]?.id ??
					next[next.length - 1]?.id ??
					null
				);
			});
			return next;
		});
	};

	const stagedSet = useMemo(
		() => new Set(status.staged.map((f) => f.path)),
		[status.staged],
	);

	const changesFiles = useMemo(
		() => [...status.unstaged].sort((a, b) => a.path.localeCompare(b.path)),
		[status.unstaged],
	);

	const stagedFiles = useMemo(
		() => [...status.staged].sort((a, b) => a.path.localeCompare(b.path)),
		[status.staged],
	);

	const openFile = (path: string, source: "changes" | "staged") => {
		const mode: DiffMode =
			source === "staged"
				? "head_to_index"
				: stagedSet.has(path)
					? "index_to_worktree"
					: "head_to_worktree";

		// Focus existing tab if already open; otherwise create and focus a new one.
		const existing = tabs.find((t) => t.path === path);
		if (existing) {
			setActiveId(existing.id);
			onOpenChange(true);
			return;
		}

		const id = crypto.randomUUID();
		setTabs((prev) => [
			...prev,
			{
				id,
				path,
				mode,
				diff: null,
				oldContent: null,
				newContent: null,
				loading: true,
				error: null,
			},
		]);
		setActiveId(id);

		onOpenChange(true);
	};

	useEffect(() => {
		if (!pendingOpen) return;
		setSidebarListTab(pendingOpen.source);
		openFile(pendingOpen.path, pendingOpen.source);
		onConsumePendingOpen();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingOpen]);

	// ⌘W closes the active diff tab when this sheet is open.
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (!e.metaKey) return;
			if (e.key.toLowerCase() !== "w") return;
			// Don't steal the shortcut while typing in inputs.
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName?.toLowerCase();
			if (
				tag === "input" ||
				tag === "textarea" ||
				(target as any)?.isContentEditable
			) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			if (activeId) closeTabById(activeId);
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, activeId, tabs]);

	useEffect(() => {
		let cancelled = false;

		const toFetch = tabs.filter(
			(t) => t.loading && t.diff === null && !t.error,
		);
		if (toFetch.length === 0) return;

		void (async () => {
			for (const tab of toFetch) {
				try {
					const bundle = await invoke<GitDiffBundle>(
						"get_git_diff_bundle",
						{
							cwd: repoPath,
							path: tab.path,
							mode: tab.mode,
						},
					);
					if (cancelled) return;
					setTabs((prev) =>
						prev.map((t) =>
							t.id === tab.id
								? {
										...t,
										diff: bundle.diff,
										oldContent: bundle.oldContent,
										newContent: bundle.newContent,
										loading: false,
										error: null,
									}
								: t,
						),
					);
				} catch (e) {
					if (cancelled) return;
					setTabs((prev) =>
						prev.map((t) =>
							t.id === tab.id
								? {
										...t,
										diff: "",
										oldContent: null,
										newContent: null,
										loading: false,
										error:
											e instanceof Error
												? e.message
												: "Failed to load diff",
									}
								: t,
						),
					);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [repoPath, tabs]);

	const active = tabs.find((t) => t.id === activeId) ?? null;

	const totalStats = useMemo(
		() => sumLineStats([...status.unstaged, ...status.staged]),
		[status.unstaged, status.staged],
	);

	const {
		ref: sidebarRef,
		width: sidebarWidth,
		onResizeMouseDown,
	} = useResizableWidth({
		storageKey: GIT_DIFF_SIDEBAR_WIDTH_KEY,
		defaultWidth: GIT_DIFF_SIDEBAR_DEFAULT_W,
		minWidth: GIT_DIFF_SIDEBAR_MIN_W,
		maxWidth: GIT_DIFF_SIDEBAR_MAX_W,
		dragEdge: "right",
	});

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="mt-8 w-[min(1100px,calc(100vw-260px))] p-0 overflow-hidden border-l-0 flex flex-col min-h-0 gap-0 bg-background"
				showCloseButton={false}
			>
				<div className="shrink-0 flex min-h-12 items-center justify-between gap-3 border-b border-border px-3 py-2">
					<div
						className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs font-medium leading-none text-muted-foreground/80"
						title={`${repoDisplayName} · ${branch}`}
					>
						<TbFolder
							className="size-4 shrink-0 text-muted-foreground/60"
							aria-hidden
						/>
						<span className="min-w-0 shrink truncate text-foreground/85">
							{repoDisplayName}
						</span>
						<span
							className="shrink-0 text-muted-foreground/35"
							aria-hidden
						>
							·
						</span>
						<TbGitBranch
							className="size-4 shrink-0 text-muted-foreground/60"
							aria-hidden
						/>
						<span className="min-w-0 shrink truncate text-muted-foreground/80">
							{branch}
						</span>
						{(totalStats.add > 0 || totalStats.del > 0) && (
							<>
								<span
									className="shrink-0 text-muted-foreground/35"
									aria-hidden
								>
									·
								</span>
								<span className="shrink-0 tabular-nums text-green-500/75">
									+{totalStats.add}
								</span>
								<span className="shrink-0 tabular-nums text-red-500/70">
									−{totalStats.del}
								</span>
							</>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => onOpenChange(false)}
						title="Close"
						className="cursor-pointer"
					>
						<TbX className="size-4" aria-hidden />
					</Button>
				</div>

				<div className="flex min-h-0 flex-1">
					{/* Left sidebar: Changes vs Staged with git actions */}
					<div
						ref={sidebarRef}
						style={{ width: sidebarWidth }}
						className="relative flex min-h-0 shrink-0 flex-col border-r border-border"
					>
						<div
							onMouseDown={onResizeMouseDown}
							className="absolute bottom-0 right-0 top-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-foreground/10"
							aria-hidden
						/>
						<Tabs
							value={sidebarListTab}
							onValueChange={(v) =>
								setSidebarListTab(v as "changes" | "staged")
							}
							className="flex min-h-0 flex-1 flex-col gap-0"
						>
							{/* Tab strip + bulk action buttons */}
							<div className="flex shrink-0 items-center border-b border-border">
								<TabsList
									variant="line"
									className="h-8 flex-1 min-w-0 rounded-none justify-start gap-0 px-1"
								>
									<TabsTrigger
										value="changes"
										className="h-full rounded-none px-2.5 text-xs"
									>
										Changes
										{changesFiles.length > 0 && (
											<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
												{changesFiles.length}
											</span>
										)}
									</TabsTrigger>
									<TabsTrigger
										value="staged"
										className="h-full rounded-none px-2.5 text-xs"
									>
										Staged
										{stagedFiles.length > 0 && (
											<span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground/60">
												{stagedFiles.length}
											</span>
										)}
									</TabsTrigger>
								</TabsList>
								{/* Bulk action buttons — contextual to active tab */}
								<div className="flex h-8 w-[52px] shrink-0 items-center justify-end gap-0.5 px-1">
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											sidebarListTab === "changes"
												? act("discard_all")
												: act("unstage_all")
										}
										disabled={
											sidebarListTab === "changes"
												? changesFiles.length === 0
												: sidebarListTab === "staged"
													? stagedFiles.length === 0
													: true
										}
										className={cn(
											"size-6 p-0 text-muted-foreground",
											sidebarListTab === "changes"
												? "hover:text-destructive"
												: "hover:text-foreground",
											!(
												(sidebarListTab === "changes" &&
													changesFiles.length > 0) ||
												(sidebarListTab === "staged" &&
													stagedFiles.length > 0)
											) &&
												"pointer-events-none opacity-0",
										)}
										title={
											sidebarListTab === "changes"
												? "Discard all"
												: "Unstage all"
										}
										aria-hidden={
											!(
												(sidebarListTab === "changes" &&
													changesFiles.length > 0) ||
												(sidebarListTab === "staged" &&
													stagedFiles.length > 0)
											)
										}
									>
										<TbMinus className="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => act("stage_all")}
										disabled={
											!(
												sidebarListTab === "changes" &&
												changesFiles.length > 0
											)
										}
										className={cn(
											"size-6 p-0 text-muted-foreground hover:text-foreground",
											!(
												sidebarListTab === "changes" &&
												changesFiles.length > 0
											) &&
												"pointer-events-none opacity-0",
										)}
										title="Stage all"
										aria-hidden={
											!(
												sidebarListTab === "changes" &&
												changesFiles.length > 0
											)
										}
									>
										<TbPlus className="size-3.5" />
									</Button>
								</div>
							</div>

							<TabsContent
								value="changes"
								className="min-h-0 flex-1 overflow-y-auto"
							>
								{changesFiles.length === 0 ? (
									<p className="px-3 py-3 text-xs text-muted-foreground/40">
										No unstaged changes
									</p>
								) : (
									changesFiles.map((f) => (
										<GitFileRow
											key={f.path}
											file={f}
											isActive={active?.path === f.path}
											onOpen={() =>
												openFile(f.path, "changes")
											}
											actions={[
												{
													icon: (
														<TbMinus className="size-3.5" />
													),
													label: "Stage file",
													onClick: () =>
														act("stage_file", {
															path: f.path,
														}),
												},
												{
													icon: (
														<TbPlus className="size-3.5" />
													),
													label: "Discard changes",
													danger: true,
													onClick: () =>
														act("discard_file", {
															path: f.path,
														}),
												},
											]}
										/>
									))
								)}
							</TabsContent>

							<TabsContent
								value="staged"
								className="min-h-0 flex-1 overflow-y-auto"
							>
								{stagedFiles.length === 0 ? (
									<p className="px-3 py-3 text-xs text-muted-foreground/40">
										No staged changes
									</p>
								) : (
									stagedFiles.map((f) => (
										<GitFileRow
											key={f.path}
											file={f}
											isActive={active?.path === f.path}
											onOpen={() =>
												openFile(f.path, "staged")
											}
											actions={[
												{
													icon: (
														<TbMinus className="size-3.5" />
													),
													label: "Unstage file",
													onClick: () =>
														act("unstage_file", {
															path: f.path,
														}),
												},
											]}
										/>
									))
								)}
							</TabsContent>
						</Tabs>
					</div>

					{/* Right diff viewer */}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						<Tabs
							value={activeId ?? ""}
							onValueChange={(v) => setActiveId(v as string)}
							className="min-h-0 flex-1 gap-0"
						>
							<>
								<TabsList
									variant="line"
									className="git-diff-tabs-scroll h-8 w-full max-w-full min-w-0 shrink-0 flex-nowrap justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-none border-b border-border"
								>
									{tabs.map((t) => (
										<TabsTrigger
											key={t.id}
											value={t.id}
											title={t.path}
											className={cn(
												"group/tab h-full max-w-60 rounded-none px-2 text-xs",
												"justify-between",
											)}
										>
											<div className="flex min-w-0 items-center gap-1.5">
												<TbFile
													className="size-3.5 shrink-0 text-muted-foreground/50"
													aria-hidden
												/>
												<span className="min-w-0 max-w-[220px] truncate">
													{filenameFromPath(t.path)}
												</span>
											</div>
											<button
												type="button"
											className={cn(
												"ml-1 shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground/55",
												"invisible group-hover/tab:visible hover:bg-muted/40 hover:text-foreground",
											)}
												onMouseDown={(e) =>
													e.preventDefault()
												}
												onClick={(e) => {
													e.stopPropagation();
													setTabs((prev) =>
														prev.filter(
															(x) =>
																x.id !== t.id,
														),
													);
													setActiveId((curr) => {
														if (curr !== t.id)
															return curr;
														const rest =
															tabs.filter(
																(x) =>
																	x.id !==
																	t.id,
															);
														return (
															rest[
																rest.length - 1
															]?.id ?? null
														);
													});
												}}
												title="Close tab"
												aria-label={`Close ${t.path}`}
											>
												<TbX
													className="size-3.5"
													aria-hidden
												/>
											</button>
										</TabsTrigger>
									))}
								</TabsList>

								{tabs.length === 0 ? (
									<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/45">
										Open a file to view its diff
									</div>
								) : null}
							</>

							{tabs.map((t) => (
								<TabsContent
									key={t.id}
									value={t.id}
									className="min-h-0 flex-1 h-full overflow-y-auto overflow-x-hidden"
								>
									{t.loading ? (
										<p className="px-3 py-3 text-xs text-muted-foreground/45">
											Loading diff…
										</p>
									) : t.error ? (
										<p className="px-3 py-3 text-xs text-destructive/80">
											{t.error}
										</p>
									) : (
										<div className="min-w-0 font-mono **:[[class*='diff-']]:font-mono">
											<DiffView
												data={{
													oldFile: {
														fileName: t.path,
														// null = no prior revision (new/untracked);
														content:
															t.oldContent === ""
																? null
																: t.oldContent,
													},
													newFile: {
														fileName: t.path,
														content:
															t.newContent === ""
																? null
																: t.newContent,
													},
													hunks: [t.diff ?? ""],
												}}
												diffViewMode={
													DiffModeEnum.Unified
												}
												diffViewTheme={isLight ? "light" : "dark"}
												diffViewHighlight
												diffViewWrap
												diffViewFontSize={12}
											/>
										</div>
									)}
								</TabsContent>
							))}
						</Tabs>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
