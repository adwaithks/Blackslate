import type { HookInfo } from "./types";
import { HandlerTypeBadge } from "./HandlerTypeBadge";

export function HookItem({
	hook,
	selected,
	onClick,
}: {
	hook: HookInfo;
	selected: boolean;
	onClick: () => void;
}) {
	const display = hook.command ?? hook.url ?? "—";
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full cursor-pointer text-left px-3 py-2 rounded-sm transition-colors ${
				selected
					? "bg-accent text-accent-foreground"
					: "text-foreground/80 hover:bg-muted/35"
			} ${hook.disabled ? "opacity-40" : ""}`}
		>
			<div className="flex items-center gap-2">
				<span className="text-xs font-medium font-mono leading-snug truncate">
					{hook.event}
				</span>
				{hook.matcher && (
					<span className="shrink-0 rounded bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground/70">
						{hook.matcher}
					</span>
				)}
				<HandlerTypeBadge type={hook.handler_type} />
			</div>
			<div className="mt-0.5 text-[10px] font-mono text-muted-foreground/55 truncate leading-snug">
				{display}
			</div>
			<div className="mt-0.5 text-[10px] text-muted-foreground/35 truncate leading-snug">
				{hook.source}
			</div>
		</button>
	);
}
