import { SiClaude } from "react-icons/si";

interface ClaudeIndicatorProps {
	model: string | null;
}

// Small badge showing the assistant is active (icon plus model name or "Code").
export function ClaudeIndicator({ model }: ClaudeIndicatorProps) {
	return (
		<span
			className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-claude-accent"
			title="Claude Code active"
		>
			<SiClaude className="!size-2.5 shrink-0" aria-hidden />
			<span className="hidden sm:inline">
				{model ?? "Code"}
			</span>
		</span>
	);
}
