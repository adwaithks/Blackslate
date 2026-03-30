import type { SkillInfo } from "./types";

export function SkillItem({
	skill,
	selected,
	onClick,
}: {
	skill: SkillInfo;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-sm transition-colors ${
				selected
					? "bg-accent text-accent-foreground"
					: "hover:bg-white/5 text-foreground/80"
			}`}
		>
			<div className="text-xs font-medium leading-snug truncate">
				{skill.name}
			</div>
			{skill.description && (
				<div className="text-[10px] text-muted-foreground/55 leading-snug mt-0.5 line-clamp-2">
					{skill.description}
				</div>
			)}
			<div className="flex items-center gap-1.5 mt-1">
				<span className="text-[10px] font-mono text-muted-foreground/40 truncate">
					{skill.source}
				</span>
				{skill.version && (
					<span className="text-[10px] text-muted-foreground/35">
						v{skill.version}
					</span>
				)}
			</div>
		</button>
	);
}
