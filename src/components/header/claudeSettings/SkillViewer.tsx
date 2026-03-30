import { useEffect, useState } from "react";
import { LuPackage } from "react-icons/lu";
import { SkillFileTree } from "@/components/skill-file-tree";
import type { SkillInfo } from "./types";
import { FileContent } from "./FileContent";

export function SkillViewer({ skill }: { skill: SkillInfo | null }) {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	// Jump back to SKILL.md when the user picks another skill in the list.
	useEffect(() => {
		setSelectedPath(skill ? skill.path : null);
	}, [skill?.path]);

	if (!skill) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground/35 select-none">
				Select a skill to view its content
			</div>
		);
	}

	const rootDir =
		skill.kind === "skill"
			? skill.path.replace(/\/SKILL\.md$/, "")
			: skill.path;
	const hasFiles = skill.files.length > 1;

	return (
		<div className="flex h-full flex-col min-h-0">
			<div className="shrink-0 border-b border-white/8 px-4 py-3">
				<div className="text-xs font-semibold leading-snug">
					{skill.name}
				</div>
				{skill.description && (
					<div className="mt-0.5 text-xs text-muted-foreground/60 leading-snug line-clamp-2">
						{skill.description}
					</div>
				)}
				<div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/40">
					<span className="flex items-center gap-1">
						<LuPackage className="size-2.5" />
						{skill.source}
					</span>
					{skill.version && <span>v{skill.version}</span>}
					{hasFiles && <span>{skill.files.length} files</span>}
				</div>
			</div>

			<div className="flex flex-1 min-h-0">
				{hasFiles && (
					<div className="w-[180px] shrink-0 border-r border-white/8 overflow-y-auto">
						<SkillFileTree
							files={skill.files}
							rootDir={rootDir}
							selectedPath={selectedPath ?? skill.path}
							onSelect={setSelectedPath}
						/>
					</div>
				)}
				<div className="flex flex-1 min-h-0 flex-col">
					<FileContent
						path={selectedPath ?? skill.path}
						rootDir={rootDir}
						isSkillMd={(selectedPath ?? skill.path) === skill.path}
					/>
				</div>
			</div>
		</div>
	);
}
