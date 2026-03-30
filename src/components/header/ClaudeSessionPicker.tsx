import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LuHistory, LuGitBranch } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { selectActiveSession, useSessionStore } from "@/store/sessions";

// ---------------------------------------------------------------------------
// Types mirroring the Rust `ClaudeSessionSummary` struct
// ---------------------------------------------------------------------------

interface ClaudeSession {
	session_id: string;
	timestamp: string;
	cwd: string;
	git_branch: string | null;
	summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoTimestamp: string): string {
	const now = Date.now();
	const then = new Date(isoTimestamp).getTime();
	if (Number.isNaN(then)) return "";
	const diffMs = now - then;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 7) return `${diffDay}d ago`;
	return new Date(isoTimestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClaudeSessionPickerProps {
	/** Absolute path of the active terminal's cwd — passed from AppLayout. */
	cwd: string;
}

export function ClaudeSessionPicker({ cwd }: ClaudeSessionPickerProps) {
	const [open, setOpen] = useState(false);
	const [sessions, setSessions] = useState<ClaudeSession[]>([]);
	const [loading, setLoading] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const { workspaces, activeWorkspaceId } = useSessionStore();
	const activeSession = selectActiveSession({
		workspaces,
		activeWorkspaceId,
	});

	// Fetch sessions when the dropdown first opens (or cwd changes while open).
	useEffect(() => {
		if (!open) return;
		setLoading(true);
		invoke<ClaudeSession[]>("list_claude_sessions", { cwd })
			.then((data) => {
				setSessions(data);
			})
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [open, cwd]);

	// Reset cached list when cwd changes so next open re-fetches.
	useEffect(() => {
		setSessions([]);
	}, [cwd]);

	// Close on outside click.
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Close on Escape.
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open]);

	function handleSelect(sessionId: string) {
		const ptyId = activeSession?.ptyId;
		if (!ptyId) return;

		const cmd = activeSession.claudeCodeActive
			? // Claude is running — use the slash command inside the REPL
				`/resume ${sessionId}\r`
			: // Claude not running — launch it with the resume flag
				`claude --resume ${sessionId}\r`;

		invoke("pty_write", { id: ptyId, data: cmd }).catch(console.error);
		setOpen(false);
	}

	return (
		<div ref={containerRef} className="relative">
			{/* Trigger */}
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				aria-haspopup="listbox"
				className="h-auto gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground rounded-sm hover:bg-white/6"
				title="Browse past Claude Code conversations (/resume)"
			>
				<LuHistory className="size-3 shrink-0" aria-hidden />
				<span>Sessions</span>
			</Button>

			{/* Dropdown panel */}
			{open && (
				<div
					role="dialog"
					aria-label="Claude Code session picker"
					className="absolute right-0 top-full z-50 mt-1 w-[500px] overflow-hidden rounded-md border border-white/8 bg-popover shadow-xl ring-1 ring-black/20"
				>
					<Command className="rounded-none bg-transparent">
						<div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
							<div className="flex items-center gap-2">
								<LuHistory className="size-3.5 shrink-0 text-muted-foreground/60" />
								<span className="text-xs font-medium text-muted-foreground/70 select-none">
									Claude Code sessions
								</span>
							</div>
							<span className="text-[10px] text-muted-foreground/35 select-none">
								missing one? cd to where you ran claude
							</span>
						</div>
						<CommandInput
							placeholder="Search by summary or session id…"
							autoFocus
						/>
						<CommandList>
							{loading && (
								<div className="py-4 text-center text-xs text-muted-foreground/50">
									Loading sessions…
								</div>
							)}
							{!loading && (
								<CommandEmpty>
									No sessions found for this directory.
								</CommandEmpty>
							)}
							{!loading && sessions.length > 0 && (
								<CommandGroup>
									{sessions.map((session) => (
										<CommandItem
											key={session.session_id}
											value={`${session.summary} ${session.git_branch ?? ""} ${session.session_id}`}
											onSelect={() =>
												handleSelect(session.session_id)
											}
											className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
										>
											{/* Summary row */}
											<span className="w-full truncate text-xs leading-snug text-foreground/90">
												{session.summary || (
													<span className="italic text-muted-foreground/50">
														(empty)
													</span>
												)}
											</span>
											{/* Meta row */}
											<span className="flex items-center gap-2 text-[10px] text-muted-foreground/55 leading-none mt-0.5">
												<span>
													{formatRelativeTime(
														session.timestamp,
													)}
												</span>
												{session.git_branch &&
													session.git_branch !==
														"HEAD" && (
														<span className="flex items-center gap-0.5">
															<LuGitBranch
																className="size-2.5"
																aria-hidden
															/>
															{session.git_branch}
														</span>
													)}
												<span className="font-mono opacity-50">
													{session.session_id.slice(
														0,
														8,
													)}
												</span>
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</div>
			)}
		</div>
	);
}
