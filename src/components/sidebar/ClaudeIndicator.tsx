import { SiClaude } from "react-icons/si";

interface ClaudeIndicatorProps {
	model: string | null;
}

/**
 * Simple Claude Code indicator: icon + "Code" label.
 */
export function ClaudeIndicator({ model }: ClaudeIndicatorProps) {
	return (
		<span
			className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-[#D97757]"
			title="Claude Code active"
		>
			<SiClaude className="!size-2.5 shrink-0" aria-hidden />
			<span className="hidden sm:inline">
				{model ?? "Code"}
			</span>
		</span>
	);
}
