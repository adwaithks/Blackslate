import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillInfo } from "./types";

/** `list_project_skills` when `projectPath` is set; idle when null. */
export function useProjectSkills(projectPath: string | null) {
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!projectPath) return;
		setAll([]);
		setLoading(true);
		invoke<SkillInfo[]>("list_project_skills", { projectPath })
			.then(setAll)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [projectPath]);

	return { all, loading };
}
