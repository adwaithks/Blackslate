import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	buildClaudeModelSwitchPayload,
	claudeModelSelectItems,
	DEFAULT_CLAUDE_MODEL_ID,
	labelForClaudeModelId,
	resolveClaudeModelIdFromParsedLabel,
	sessionShowsClaudeModelPicker,
} from "@/lib/claudeModels";
import { selectActiveSession, useSessionStore } from "@/store/sessions";
import { requestActiveTerminalFocus } from "@/lib/focusActiveTerminal";
import { cn } from "@/lib/utils";

const triggerClassName =
	"h-6.5 min-w-[4.25rem] shrink-0 gap-1 rounded-sm border border-border bg-muted/35 px-2 py-0.5 text-[10px] font-medium text-claude-accent/90 outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=sm]:h-6.5 data-[size=sm]:rounded-sm";

/**
 * Header control: when Claude Code is active in the active session, pick a model
 * and send `/model <id>` to that PTY (same bytes as typing + Enter).
 */
export function ClaudeModelSelect() {
	const { workspaces, activeWorkspaceId, setClaudeModel } = useSessionStore();
	const activeSession = selectActiveSession({
		workspaces,
		activeWorkspaceId,
	});
	const [optimisticId, setOptimisticId] = useState<string | null>(null);

	useEffect(() => {
		setOptimisticId(null);
	}, [activeSession?.id]);

	const resolvedId = useMemo(
		() =>
			resolveClaudeModelIdFromParsedLabel(
				activeSession?.claudeModel ?? null,
			),
		[activeSession?.claudeModel],
	);

	const value = useMemo(() => {
		return optimisticId ?? resolvedId ?? DEFAULT_CLAUDE_MODEL_ID;
	}, [optimisticId, resolvedId]);

	const items = useMemo(() => claudeModelSelectItems(), []);

	const handleValueChange = useCallback(
		(next: string | null) => {
			if (!next || !activeSession) return;
			const ptyId = activeSession.ptyId;
			if (!ptyId) return;
			const label = labelForClaudeModelId(next);
			if (!label) return;
			setOptimisticId(next);
			setClaudeModel(activeSession.id, label);
			invoke("pty_write", {
				id: ptyId,
				data: buildClaudeModelSwitchPayload(next),
			}).catch(console.error);
		},
		[activeSession, setClaudeModel],
	);

	if (!sessionShowsClaudeModelPicker(activeSession)) {
		return null;
	}

	/** No stream-reported model yet — avoid showing a bogus default (e.g. Sonnet). */
	const hasKnownModel =
		(activeSession?.claudeModel != null &&
			activeSession.claudeModel.trim() !== "") ||
		optimisticId != null;
	if (!hasKnownModel) {
		return null;
	}

	return (
		<Select
			value={value}
			onValueChange={handleValueChange}
			onOpenChangeComplete={(open) => {
				if (!open) requestActiveTerminalFocus();
			}}
			items={items}
		>
			<SelectTrigger
				size="sm"
				aria-label="Model"
				className={cn(
					triggerClassName,
					"[&_svg]:size-3 [&_svg]:opacity-60",
				)}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end" sideOffset={4} className="min-w-34">
				{items.map((opt) => (
					<SelectItem
						key={opt.value}
						value={opt.value}
						className="py-1.5 text-xs"
					>
						{opt.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
