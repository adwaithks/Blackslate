import { FormEvent, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LuSend } from "react-icons/lu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClaudeModelSelect } from "@/components/header/ClaudeModelSelect";
import { buildClaudeMessagePayload } from "@/lib/claudeModels";
import { requestActiveTerminalFocus } from "@/lib/focusActiveTerminal";
import { cn } from "@/lib/utils";
import { selectActiveSession, useSessionStore } from "@/store/sessions";

/**
 * Claude message composer: lives below the terminal panes and only renders
 * when Claude Code is active in the current session.
 */
export function MessageComposer() {
	const { workspaces, activeWorkspaceId } = useSessionStore();
	const activeSession = selectActiveSession({
		workspaces,
		activeWorkspaceId,
	});

	const [value, setValue] = useState("");

	const handleSubmit = useCallback(
		async (event?: FormEvent) => {
			if (event) {
				event.preventDefault();
			}

			const text = value.trim();
			if (!text || !activeSession?.ptyId) return;

			try {
				await invoke("pty_write", {
					id: activeSession.ptyId,
					data: buildClaudeMessagePayload(text),
				});
				setValue("");
				requestActiveTerminalFocus();
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error(error);
			}
		},
		[activeSession?.ptyId, value],
	);

	if (!activeSession?.claudeCodeActive) {
		return null;
	}

	const canSend = Boolean(value.trim() && activeSession?.ptyId);

	return (
		<form
			onSubmit={handleSubmit}
			className="mb-3 mt-2 mx-auto w-full px-3 md:px-0 md:w-[70%] lg:w-[60%]"
		>
			<div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
				<Textarea
					value={value}
					onChange={(event) => setValue(event.target.value)}
					placeholder="Send a message to Claude…"
					rows={3}
					className="w-full resize-none bg-transparent px-3 py-2.5 text-xs leading-snug text-foreground outline-none placeholder:text-muted-foreground"
				/>
				<div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
					<div className="flex min-w-0 items-center gap-2">
						<ClaudeModelSelect />
					</div>
					<Button
						type="submit"
						size="icon"
						variant="ghost"
						disabled={!canSend}
						className={cn(
							"h-7 w-7 shrink-0 rounded-md border border-border text-xs",
							canSend
								? "bg-white text-black"
								: "bg-muted/40 text-muted-foreground",
						)}
						aria-label="Send message"
					>
						<LuSend className="size-3.5" aria-hidden />
					</Button>
				</div>
			</div>
		</form>
	);
}
