import { useLayoutEffect, useRef } from "react";
import { IoAdd, IoClose, IoPencil } from "react-icons/io5";
import { SiClaude } from "react-icons/si";
import {
	useSessionStore,
	terminalDisplayName,
	type Session,
	type Workspace,
} from "@/store/sessions";
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
import { confirmCloseSessionInWorkspace } from "@/lib/closeConfirm";

/** Pixels to apply for one wheel “line” (DOM_DELTA_LINE) — matches typical browser step. */
const WHEEL_LINE_PX = 16;

/**
 * Map vertical mouse wheel / trackpad to horizontal scroll on `el`.
 * Returns true if the event was consumed (caller should preventDefault / stopPropagation).
 */
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

interface WorkspaceTabBarProps {
	workspace: Workspace;
}

export function WorkspaceTabBar({ workspace }: WorkspaceTabBarProps) {
	const { activateSession, closeSession, createSessionInWorkspace } =
		useSessionStore();

	const tabBarRef = useRef<HTMLDivElement>(null);
	const tabScrollRef = useRef<HTMLDivElement>(null);
	const sessionTabRefs = useRef(new Map<string, HTMLButtonElement | null>());
	const activeId = workspace.activeSessionId;

	useLayoutEffect(() => {
		const row = tabBarRef.current;
		const scrollEl = tabScrollRef.current;
		if (!row || !scrollEl) return;

		const onWheel = (e: WheelEvent) => {
			if (!tryScrollHorizontallyFromWheel(e, scrollEl)) return;
			if (e.cancelable) e.preventDefault();
			e.stopPropagation();
		};

		// Capture: run before descendants / React; non-passive: allow preventDefault (WKWebView + mouse wheels).
		const opts: AddEventListenerOptions = { passive: false, capture: true };
		row.addEventListener("wheel", onWheel, opts);
		return () => row.removeEventListener("wheel", onWheel, opts);
	}, []);

	useLayoutEffect(() => {
		const scrollEl = tabScrollRef.current;
		const activeTab = activeId
			? (sessionTabRefs.current.get(activeId) ?? null)
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
	}, [activeId, workspace.sessions.length]);

	const requestCloseSession = async (sessionId: string) => {
		const ok = await confirmCloseSessionInWorkspace(workspace, sessionId);
		if (ok) closeSession(workspace.id, sessionId);
	};

	return (
		<Tabs
			className="w-full min-w-0"
			value={activeId}
			onValueChange={(id) => activateSession(workspace.id, id as string)}
		>
			{/*
			 * Grid: scrollable tabs (minmax(0,1fr) so overflow-x works) + fixed + column.
			 * Sticky + inside flex/overflow is unreliable in WKWebView; this keeps + always clickable.
			 */}
			<div
				ref={tabBarRef}
				className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch border-b border-border bg-background"
			>
				<div
					ref={tabScrollRef}
					className="workspace-tabs-scroll min-h-10 min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain"
				>
					<TabsList
						variant="line"
						className="flex h-10 w-max max-w-none min-w-min flex-nowrap rounded-none"
					>
						{workspace.sessions.map((session) => (
							<SessionTabTrigger
								key={session.id}
								session={session}
								onClose={() => requestCloseSession(session.id)}
								tabRef={(el) => {
									if (el) {
										sessionTabRefs.current.set(session.id, el);
									} else {
										sessionTabRefs.current.delete(session.id);
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
					className="h-10 w-9 shrink-0 cursor-pointer rounded-none border-l border-border bg-background px-0 text-muted-foreground hover:bg-muted/40"
					onClick={() => createSessionInWorkspace(workspace.id)}
					title="New tab (⌘T)"
					aria-label="New tab"
				>
					<IoAdd className="mx-auto size-4 shrink-0" />
				</Button>
			</div>
		</Tabs>
	);
}

interface SessionTabTriggerProps {
	session: Session;
	onClose: () => void;
	tabRef?: (el: HTMLButtonElement | null) => void;
}

function SessionTabTrigger({
	session,
	onClose,
	tabRef,
}: SessionTabTriggerProps) {
	const openRenameSession = useRenameUiStore((s) => s.openSession);

	const label = terminalDisplayName(session);

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
						value={session.id}
					>
						{session.claudeCodeActive && (
							<SiClaude
								className={cn(
									"size-2.5 shrink-0",
									session.claudeState === "thinking"
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
					onClick={() => openRenameSession(session.id)}
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
