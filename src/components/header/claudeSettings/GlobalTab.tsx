import { useEffect, useState } from "react";
import { LuSearch } from "react-icons/lu";
import type { SkillInfo } from "./types";
import { SkillItem } from "./SkillItem";
import { SkillViewer } from "./SkillViewer";
import { useGlobalSkills } from "./useGlobalSkills";

// Machine-wide skills or slash commands: searchable list plus file preview.
export function GlobalTab({ kind }: { kind: "skill" | "command" }) {
	const { all, loading } = useGlobalSkills();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<SkillInfo | null>(null);

	// Align with previous single effect: clear selection when the tab remounts / list reloads.
	useEffect(() => {
		setSelected(null);
	}, []);

	const items = all.filter((s) => s.kind === kind);
	const filtered = query.trim()
		? items.filter(
				(s) =>
					s.name.toLowerCase().includes(query.toLowerCase()) ||
					s.description.toLowerCase().includes(query.toLowerCase()) ||
					s.source.toLowerCase().includes(query.toLowerCase()),
			)
		: items;

	const label = kind === "skill" ? "skills" : "commands";

	return (
		<div className="flex flex-1 min-h-0 gap-0">
			<div className="flex w-[240px] shrink-0 flex-col border-r border-border">
				<div className="flex items-center gap-2 border-b border-border px-3 py-2">
					<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={`Filter ${label}…`}
						className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
					/>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto p-1">
					{loading && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							Loading…
						</div>
					)}
					{!loading && filtered.length === 0 && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							{query ? "No matches" : `No global ${label}`}
						</div>
					)}
					{filtered.map((item) => (
						<SkillItem
							key={item.path}
							skill={item}
							selected={selected?.path === item.path}
							onClick={() => setSelected(item)}
						/>
					))}
				</div>
			</div>
			<div className="flex flex-1 min-h-0 flex-col">
				<SkillViewer skill={selected} />
			</div>
		</div>
	);
}
