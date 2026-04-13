import { useLayoutEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { IoAdd, IoClose, IoPencil } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	useTerminalStore,
	selectActiveWorkspace,
	selectActiveWorkspaceTabBarSignature,
	terminalDisplayName,
	type Terminal,
} from "@/store/terminals";
import { useRenameUiStore } from "@/store/renameUiStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { confirmCloseTerminalInWorkspace } from "@/lib/closeConfirm";

// How many pixels one mouse-wheel "line" counts as (matches most browsers).
const WHEEL_LINE_PX = 16;

// Turn vertical wheel/trackpad movement into sideways scrolling on `el`. Returns true if we handled it.
function tryScrollHorizontallyFromWheel(
	e: WheelEvent,
	el: HTMLDivElement,
): boolean {
	const overflow = el.scrollWidth - el.clientWidth;
	if (overflow <= 0) return false;

	let dx = e.deltaX;
	let dy = e.deltaY;
	switch (e.deltaMode) {
		case WheelEvent.DOM_DELTA_LINE:
			dx *= WHEEL_LINE_PX;
			dy *= WHEEL_LINE_PX;
			break;
		case WheelEvent.DOM_DELTA_PAGE:
			dx *= el.clientWidth;
			dy *= el.clientHeight;
			break;
		default:
			break;
	}

	// Prefer native horizontal delta; otherwise treat vertical wheel as horizontal strip scroll.
	const delta = dx !== 0 ? dx : dy;
	if (delta === 0) return false;

	el.scrollLeft += delta;
	return true;
}

export function WorkspaceTabBar() {
	useTerminalStore(selectActiveWorkspaceTabBarSignature);
	const { activateTerminal, closeTerminal, createTerminalInWorkspace } =
		useTerminalStore(
			useShallow((s) => ({
				activateTerminal: s.activateTerminal,
				closeTerminal: s.closeTerminal,
				createTerminalInWorkspace: s.createTerminalInWorkspace,
			})),
		);

	const workspace = selectActiveWorkspace(useTerminalStore.getState());
	const activePane = workspace
		? workspace.panes.find((p) => p.id === workspace.activePaneId)
		: undefined;
	const activeId = activePane?.activeTerminalId ?? "";
	const activeTerminals = activePane?.terminals ?? [];

	const tabBarRef = useRef<HTMLDivElement>(null);
	const tabScrollRef = useRef<HTMLDivElement>(null);
	const terminalTabRefs = useRef(new Map<string, HTMLButtonElement | null>());

	useLayoutEffect(() => {
		const row = tabBarRef.current;
		const scrollEl = tabScrollRef.current;
		if (!row || !scrollEl) return;

		const onWheel = (e: WheelEvent) => {
			if (!tryScrollHorizontallyFromWheel(e, scrollEl)) return;
			if (e.cancelable) e.preventDefault();
			e.stopPropagation();
		};

		// Listen early and allow blocking default scroll so wheel can move tabs sideways.
		const opts: AddEventListenerOptions = { passive: false, capture: true };
		row.addEventListener("wheel", onWheel, opts);
		return () => row.removeEventListener("wheel", onWheel, opts);
	}, []);

	useLayoutEffect(() => {
		const scrollEl = tabScrollRef.current;
		const activeTab = activeId
			? (terminalTabRefs.current.get(activeId) ?? null)
			: null;
		if (!scrollEl || !activeTab) return;

		// Wait one frame so newly-created tabs have final layout before we reveal them.
		const raf = requestAnimationFrame(() => {
			activeTab.scrollIntoView({
				block: "nearest",
				inline: "nearest",
			});
		});

		return () => cancelAnimationFrame(raf);
	}, [activeId, activeTerminals.length]);

	if (!workspace) return null;

	const requestCloseTerminalTab = async (terminalId: string) => {
		const ok = await confirmCloseTerminalInWorkspace(workspace, terminalId);
		if (ok) closeTerminal(workspace.id, terminalId);
	};

	// Tab row: scrolling tabs plus a fixed + column so the add button stays tappable.
	return (
		<Tabs
			className="w-full min-w-0"
			value={activeId}
			onValueChange={(id) => activateTerminal(workspace.id, id as string)}
		>
			<div
				ref={tabBarRef}
				className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch border-b border-border bg-background"
			>
				<div
					ref={tabScrollRef}
					className="workspace-tabs-scroll min-h-10 min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain"
					onDoubleClick={(e) => {
						// Only fire when clicking on empty tab-bar space, not on a tab or its children.
						if (e.target !== e.currentTarget) return;
						createTerminalInWorkspace(workspace.id);
					}}
				>
					<TabsList
						variant="line"
						className="flex h-10 w-max max-w-none min-w-min flex-nowrap rounded-none"
					>
						{activeTerminals.map((term) => (
							<TerminalTabTrigger
								key={term.id}
								terminal={term}
								onClose={() => requestCloseTerminalTab(term.id)}
								tabRef={(el) => {
									if (el) {
										terminalTabRefs.current.set(term.id, el);
									} else {
										terminalTabRefs.current.delete(term.id);
									}
								}}
							/>
						))}
					</TabsList>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-10 w-9 shrink-0 cursor-pointer rounded-none border-0 border-l border-border bg-background px-0 text-muted-foreground hover:bg-muted/40 focus-visible:border-0 focus-visible:border-l focus-visible:border-ring"
					onClick={() => createTerminalInWorkspace(workspace.id)}
					title="New tab (⌘T)"
					aria-label="New tab"
				>
					<IoAdd className="mx-auto size-4 shrink-0" />
				</Button>
			</div>
		</Tabs>
	);
}

interface TerminalTabTriggerProps {
	terminal: Terminal;
	onClose: () => void;
	tabRef?: (el: HTMLButtonElement | null) => void;
}

function TerminalTabTrigger({
	terminal,
	onClose,
	tabRef,
}: TerminalTabTriggerProps) {
	const openRenameTerminal = useRenameUiStore((s) => s.openTerminal);

	const label = terminalDisplayName(terminal);

	return (
		<ContextMenu>
			<ContextMenuTrigger
				className="inline-flex min-w-0 shrink-0"
				render={
					<TabsTrigger
						className={cn(
							"group/tab flex-none w-48 max-w-68 rounded-none",
							"justify-between gap-1 px-2 hover:bg-muted/45 data-active:hover:bg-transparent",
						)}
						ref={tabRef}
						value={terminal.id}
					>
						{terminal.claudeCodeActive && (
							<SiClaude
								className={cn(
									"size-2.5 shrink-0",
									terminal.claudeState === "thinking"
										? "animate-pulse text-claude-accent"
										: "text-claude-accent",
								)}
								aria-hidden
							/>
						)}

						<span className="min-w-0 flex-1 truncate text-xs text-center">
							{label}
						</span>

						<button
							type="button"
							className={cn(
								"ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 transition-opacity",
								"opacity-0 group-hover/tab:opacity-100",
								"hover:bg-muted/50 hover:text-muted-foreground",
							)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={(e) => {
								e.stopPropagation();
								onClose();
							}}
							title="Close tab"
							aria-label={`Close ${label}`}
						>
							<IoClose className="size-3" />
						</button>
					</TabsTrigger>
				}
			/>

			<ContextMenuContent className="min-w-44">
				<ContextMenuItem
					className="gap-2 text-xs"
					onClick={() => openRenameTerminal(terminal.id)}
				>
					<IoPencil className="size-3.5 opacity-70" aria-hidden />
					Rename
					<ContextMenuShortcut className="text-muted-foreground">
						⌘R
					</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem
					className="gap-2 text-xs"
					onClick={() => onClose()}
				>
					<IoClose className="size-3.5 opacity-70" aria-hidden />
					Close tab
					<ContextMenuShortcut className="text-muted-foreground">
						⌘W
					</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
