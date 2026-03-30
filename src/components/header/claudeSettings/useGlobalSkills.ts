import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SkillInfo } from "./types";

/** `list_global_skills` once on mount (global skills/commands tab). */
export function useGlobalSkills() {
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setAll([]);
		setLoading(true);
		invoke<SkillInfo[]>("list_global_skills")
			.then(setAll)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	return { all, loading };
}
