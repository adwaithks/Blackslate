import { useEffect, useState } from "react";
import { LuSearch } from "react-icons/lu";
import type { ClaudeProject, SkillInfo } from "./types";
import { ProjectPicker } from "./ProjectPicker";
import { SkillItem } from "./SkillItem";
import { SkillViewer } from "./SkillViewer";
import { useProjectSkills } from "./useProjectSkills";

/** Project-scoped skills/commands: pick a Claude project, then filter + viewer. */
export function ProjectTab({ kind }: { kind: "skill" | "command" }) {
	const [selectedProject, setSelectedProject] =
		useState<ClaudeProject | null>(null);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<SkillInfo | null>(null);

	const { all, loading } = useProjectSkills(selectedProject?.path ?? null);

	useEffect(() => {
		if (!selectedProject) return;
		setSelected(null);
	}, [selectedProject?.path]);

	const items = all.filter((s) => s.kind === kind);
	const filtered = query.trim()
		? items.filter(
				(s) =>
					s.name.toLowerCase().includes(query.toLowerCase()) ||
					s.description.toLowerCase().includes(query.toLowerCase()),
			)
		: items;

	const label = kind === "skill" ? "skills" : "commands";

	return (
		<div className="flex flex-1 min-h-0 flex-col">
			<div className="shrink-0 border-b border-border px-3 py-2">
				<ProjectPicker
					selected={selectedProject}
					onSelect={(p) => {
						setSelectedProject(p);
						setSelected(null);
					}}
				/>
			</div>
			{selectedProject ? (
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
									{query
										? "No matches"
										: `No ${label} in this project`}
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
			) : (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/35 select-none">
					Pick a project to see its {label}
				</div>
			)}
		</div>
	);
}
