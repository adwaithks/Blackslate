import { useState } from "react";
import { LuBrain, LuHistory, LuSettings } from "react-icons/lu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClaudeSessionPicker } from "@/components/header/ClaudeSessionPicker";
import { ClaudeSettingsSheet } from "@/components/header/ClaudeSettingsSheet";

export interface TitlebarClaudeMenuProps {
	/** Active terminal cwd — passed through to session picker. */
	cwd: string;
}

/**
 * Gear menu for Claude Code resources / sessions plus their sheets.
 */
export function TitlebarClaudeMenu({ cwd }: TitlebarClaudeMenuProps) {
	const [claudeSettingsOpen, setClaudeSettingsOpen] = useState(false);
	const [claudeSessionsOpen, setClaudeSessionsOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					type="button"
					className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
					aria-label="Claude Code: resources and sessions"
				>
					<LuSettings className="size-4 shrink-0" aria-hidden />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-[9rem]">
					<DropdownMenuItem
						className="gap-2 text-xs"
						onClick={() => setClaudeSettingsOpen(true)}
					>
						<LuBrain
							className="size-3 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						Resources
					</DropdownMenuItem>
					<DropdownMenuItem
						className="gap-2 text-xs"
						onClick={() => setClaudeSessionsOpen(true)}
					>
						<LuHistory
							className="size-3 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						Sessions
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ClaudeSettingsSheet
				open={claudeSettingsOpen}
				onOpenChange={setClaudeSettingsOpen}
			/>
			<ClaudeSessionPicker
				cwd={cwd}
				open={claudeSessionsOpen}
				onOpenChange={setClaudeSessionsOpen}
				trigger="menu"
			/>
		</>
	);
}
