import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LuHistory } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { selectActiveSession, useSessionStore } from "@/store/sessions";
import { buildResumePtyPayload } from "./resumeClaudeInput";
import { ClaudeSessionPickerDropdown } from "./ClaudeSessionPickerDropdown";
import { useClaudeSessionsList } from "./useClaudeSessionsList";
import { usePickerDismiss } from "./usePickerDismiss";

interface ClaudeSessionPickerProps {
	/** Absolute path of the active terminal cwd — from AppTitlebar / layout. */
	cwd: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/**
	 * `menu` — no Sessions button; panel uses fixed position (titlebar Claude menu).
	 * `button` — default trigger beside other controls.
	 */
	trigger?: "button" | "menu";
}

export function ClaudeSessionPicker({
	cwd,
	open: openProp,
	onOpenChange,
	trigger = "button",
}: ClaudeSessionPickerProps) {
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = openProp ?? uncontrolledOpen;
	const setOpen = useCallback(
		(next: boolean) => {
			onOpenChange?.(next);
			if (openProp === undefined) setUncontrolledOpen(next);
		},
		[openProp, onOpenChange],
	);
	const containerRef = useRef<HTMLDivElement>(null);

	const { sessions, loading } = useClaudeSessionsList(open, cwd);
	const closePicker = useCallback(() => setOpen(false), [setOpen]);
	usePickerDismiss(open, closePicker, containerRef);

	const { workspaces, activeWorkspaceId } = useSessionStore();
	const activeSession = selectActiveSession({
		workspaces,
		activeWorkspaceId,
	});

	function handleSelect(sessionId: string) {
		if (!activeSession?.ptyId) return;
		const data = buildResumePtyPayload(
			sessionId,
			activeSession.claudeCodeActive,
		);
		invoke("pty_write", { id: activeSession.ptyId, data }).catch(
			console.error,
		);
		setOpen(false);
	}

	return (
		<div ref={containerRef} className="relative">
			{trigger === "button" ? (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setOpen(!open)}
					aria-expanded={open}
					aria-haspopup="listbox"
					className="h-auto gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground"
					title="Browse past Claude Code conversations (/resume)"
				>
					<LuHistory className="size-3 shrink-0" aria-hidden />
					<span>Sessions</span>
				</Button>
			) : null}

			{open && (
				<ClaudeSessionPickerDropdown
					sessions={sessions}
					loading={loading}
					onPickSession={handleSelect}
					variant={trigger === "menu" ? "fixed" : "anchor"}
				/>
			)}
		</div>
	);
}
