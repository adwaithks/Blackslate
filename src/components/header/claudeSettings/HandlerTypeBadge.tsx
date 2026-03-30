import { LuGlobe, LuMessageSquare, LuZap } from "react-icons/lu";

export function HandlerTypeBadge({ type: t }: { type: string }) {
	const cfg =
		t === "http"
			? { icon: LuGlobe, label: "http", cls: "text-sky-400/80" }
			: t === "prompt"
				? {
						icon: LuMessageSquare,
						label: "prompt",
						cls: "text-violet-400/80",
					}
				: { icon: LuZap, label: "cmd", cls: "text-amber-400/80" };
	const Icon = cfg.icon;
	return (
		<span
			className={`flex items-center gap-0.5 font-mono text-[10px] ${cfg.cls}`}
		>
			<Icon className="size-2.5 shrink-0" />
			{cfg.label}
		</span>
	);
}
