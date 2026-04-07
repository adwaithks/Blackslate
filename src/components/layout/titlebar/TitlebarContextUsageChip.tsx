import type { TurnUsage } from "@/store/sessions";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

function fmtInt(n: number): string {
	return n.toLocaleString();
}

const DEFAULT_MAX_TOKENS = 200_000;

function contextLengthFromUsage(u: TurnUsage): number {
	return u.inputTokens + u.cacheRead + u.cacheWrite;
}

export interface TitlebarContextUsageChipProps {
	claudeModel: string | null;
	lastTurnUsage: TurnUsage | null;
}

export function TitlebarContextUsageChip({
	claudeModel,
	lastTurnUsage,
}: TitlebarContextUsageChipProps) {
	if (!lastTurnUsage) return null;

	const maxTokens = DEFAULT_MAX_TOKENS;
	const contextLen = contextLengthFromUsage(lastTurnUsage);
	const pct = Math.min(100, (contextLen / maxTokens) * 100);

	return (
		<Tooltip>
			<TooltipTrigger>
				<div className="flex cursor-pointer items-center rounded-sm bg-muted/40 px-1.5 py-1 text-[11px] text-muted-foreground">
					<span className="tabular-nums">Ctx {pct.toFixed(1)}%</span>
				</div>
			</TooltipTrigger>
			<TooltipContent
				side="bottom"
				sideOffset={8}
				className="flex max-w-xs flex-col items-start gap-1 px-3 py-2 shadow-lg"
			>
				<div className="text-[12px] font-bold text-popover-foreground">
					Context
				</div>
				<div className="text-[10px] font-medium text-popover-foreground">
					Length: {fmtInt(contextLen)} tokens
				</div>
				<div className="text-[10px] font-medium text-popover-foreground">
					Max: {fmtInt(maxTokens)} tokens
				</div>
				{claudeModel ? (
					<div className="text-[10px] font-medium text-muted-foreground">
						Model: {claudeModel}
					</div>
				) : null}
			</TooltipContent>
		</Tooltip>
	);
}
