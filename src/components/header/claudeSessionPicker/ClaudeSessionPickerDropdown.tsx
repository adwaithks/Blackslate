import { LuGitBranch, LuHistory } from "react-icons/lu";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import type { ClaudeSession } from "./types";
import { formatRelativeTime } from "./formatRelativeTime";

interface ClaudeSessionPickerDropdownProps {
	sessions: ClaudeSession[];
	loading: boolean;
	onPickSession: (sessionId: string) => void;
	/** `fixed` — under titlebar when opened from Claude menu (no anchor button). */
	variant?: "anchor" | "fixed";
}

/**
 * cmdk panel: filterable list of past sessions for the current `cwd` (set by parent).
 */
export function ClaudeSessionPickerDropdown({
	sessions,
	loading,
	onPickSession,
	variant = "anchor",
}: ClaudeSessionPickerDropdownProps) {
	const positionClass =
		variant === "fixed"
			? "fixed right-3 top-[42px] z-50 mt-0"
			: "absolute right-0 top-full z-50 mt-1";

	return (
		<div
			role="dialog"
			aria-label="Claude Code session picker"
			className={`${positionClass} w-[500px] overflow-hidden rounded-md border border-white/8 bg-popover shadow-xl ring-1 ring-black/20`}
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
										onPickSession(session.session_id)
									}
									className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
								>
									<span className="w-full truncate text-xs leading-snug text-foreground/90">
										{session.summary || (
											<span className="italic text-muted-foreground/50">
												(empty)
											</span>
										)}
									</span>
									<span className="flex items-center gap-2 text-[10px] text-muted-foreground/55 leading-none mt-0.5">
										<span>
											{formatRelativeTime(
												session.timestamp,
											)}
										</span>
										{session.git_branch &&
											session.git_branch !== "HEAD" && (
												<span className="flex items-center gap-0.5">
													<LuGitBranch
														className="size-2.5"
														aria-hidden
													/>
													{session.git_branch}
												</span>
											)}
										<span className="font-mono opacity-50">
											{session.session_id.slice(0, 8)}
										</span>
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					)}
				</CommandList>
			</Command>
		</div>
	);
}
