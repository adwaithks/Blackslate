import { SiClaude } from "react-icons/si";
import type { ClaudeState } from "@/store/sessions";

interface ClaudeIndicatorProps {
	state: ClaudeState;
	model: string | null;
}

/**
 * Small orange Claude mark when Code is active in this session: idle / thinking / waiting.
 * `title` mirrors the label for quick hover without opening the row tooltip.
 */
export function ClaudeIndicator({ state, model }: ClaudeIndicatorProps) {
	const label =
		state === "thinking"
			? "Claude is thinking…"
			: state === "waiting"
				? "Claude is waiting for your input"
				: "Claude Code running";

	return (
		<span
			className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-[#D97757]"
			title={label}
		>
			<span className="relative flex shrink-0 items-center justify-center size-2.5">
				<SiClaude className="!size-2.5 shrink-0" aria-hidden />
				{state === "thinking" && (
					<span className="absolute inset-0 rounded-full bg-[#D97757]/30 animate-ping" />
				)}
			</span>
			<span className="hidden sm:inline">
				{state === "thinking" ? "…" : (model ?? "Code")}
			</span>
		</span>
	);
}
