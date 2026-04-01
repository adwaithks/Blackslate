import type { HookInfo } from "./types";
import { HandlerTypeBadge } from "./HandlerTypeBadge";
import { HookDetailRow } from "./HookDetailRow";

export function HookViewer({ hook }: { hook: HookInfo | null }) {
	if (!hook) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground/35 select-none">
				Select a hook to view details
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col min-h-0 overflow-y-auto px-4 py-3">
			<div className="mb-3 flex items-center gap-2 flex-wrap">
				<span className="text-xs font-semibold font-mono">
					{hook.event}
				</span>
				{hook.matcher && (
					<span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
						{hook.matcher}
					</span>
				)}
				<HandlerTypeBadge type={hook.handler_type} />
				{hook.disabled && (
					<span className="rounded px-1.5 py-0.5 text-[10px] bg-red-500/15 text-red-400/80">
						disabled
					</span>
				)}
			</div>

			<div className="flex flex-col divide-y divide-border/60">
				{hook.command && (
					<HookDetailRow label="Command" value={hook.command} mono />
				)}
				{hook.url && <HookDetailRow label="URL" value={hook.url} mono />}
				{hook.matcher ? (
					<HookDetailRow label="Matcher" value={hook.matcher} mono />
				) : (
					<HookDetailRow label="Matcher" value="(all)" />
				)}
				<HookDetailRow label="Type" value={hook.handler_type} />
				{hook.timeout != null && (
					<HookDetailRow label="Timeout" value={`${hook.timeout}s`} />
				)}
				<HookDetailRow
					label="Background"
					value={hook.run_in_background ? "yes" : "no"}
				/>
				<HookDetailRow label="Source" value={hook.source} mono />
			</div>
		</div>
	);
}
