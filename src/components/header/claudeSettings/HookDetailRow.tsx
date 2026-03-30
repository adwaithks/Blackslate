export function HookDetailRow({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex min-w-0 gap-3 py-0.5">
			<span className="w-24 shrink-0 text-[10px] text-muted-foreground/45 uppercase tracking-wide leading-relaxed">
				{label}
			</span>
			<span
				className={`min-w-0 flex-1 break-all text-xs leading-relaxed text-foreground/75 ${mono ? "font-mono" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}
