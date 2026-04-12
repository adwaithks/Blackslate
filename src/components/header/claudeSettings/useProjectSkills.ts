import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toastError } from "@/lib/toastError";
import type { SkillInfo } from "./types";

// Load skills/commands for a project folder; does nothing until a project is picked.
export function useProjectSkills(projectPath: string | null) {
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!projectPath) return;
		setAll([]);
		setLoading(true);
		invoke<SkillInfo[]>("list_project_skills", { projectPath })
			.then(setAll)
			.catch((e) => {
				setAll([]);
				toastError("Could not load project skills", e);
			})
			.finally(() => setLoading(false));
	}, [projectPath]);

	return { all, loading };
}
