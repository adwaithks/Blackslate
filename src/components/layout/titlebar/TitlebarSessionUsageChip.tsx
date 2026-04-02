import { LuArrowDown, LuArrowUp } from "react-icons/lu";
import type { TurnUsage } from "@/store/sessions";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

function fmt(n: number): string {
	return n.toLocaleString();
}

function UsageBreakdown({
	label,
	usage,
}: {
	label: string;
	usage: TurnUsage;
}) {
	return (
		<>
			<div className="text-[12px] font-bold text-popover-foreground">
				{label}
			</div>
			<div className="text-[10px] font-medium text-popover-foreground">
				Input: {fmt(usage.inputTokens)}
			</div>
			<div className="text-[10px] font-medium text-popover-foreground">
				Output: {fmt(usage.outputTokens)}
			</div>
			<div className="text-[10px] font-medium text-popover-foreground">
				Cache read: {fmt(usage.cacheRead)}
			</div>
			<div className="text-[10px] font-medium text-popover-foreground">
				Cache write: {fmt(usage.cacheWrite)}
			</div>
		</>
	);
}

export interface TitlebarSessionUsageChipProps {
	cumulativeUsage: TurnUsage | null;
	lastTurnUsage: TurnUsage | null;
}

/**
 * Compact in/out token counts for the active Claude session; tooltip shows full breakdown.
 */
export function TitlebarSessionUsageChip({
	cumulativeUsage,
	lastTurnUsage,
}: TitlebarSessionUsageChipProps) {
	if (!cumulativeUsage) return null;

	return (
		<Tooltip>
			<TooltipTrigger>
				<div className="flex cursor-pointer items-center gap-1 rounded-sm bg-muted/40 px-1.5 py-1 text-[11px] text-muted-foreground">
					<LuArrowUp className="size-3 shrink-0" aria-hidden />
					<span className="tabular-nums">
						{fmt(cumulativeUsage.inputTokens)}
					</span>
					<LuArrowDown className="size-3 shrink-0" aria-hidden />
					<span className="tabular-nums">
						{fmt(cumulativeUsage.outputTokens)}
					</span>
				</div>
			</TooltipTrigger>
			<TooltipContent
				side="bottom"
				sideOffset={8}
				className="flex max-w-xs flex-col items-start gap-1.5 px-3 py-2 shadow-lg"
			>
				<UsageBreakdown label="Session total" usage={cumulativeUsage} />
				{lastTurnUsage ? (
					<>
						<Separator className="my-2 border border-white/20" />
						<UsageBreakdown label="Last turn" usage={lastTurnUsage} />
					</>
				) : null}
			</TooltipContent>
		</Tooltip>
	);
}
