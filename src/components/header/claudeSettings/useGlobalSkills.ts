import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toastError } from "@/lib/toastError";
import type { SkillInfo } from "./types";

// Load machine-wide skills and slash commands once when this tab mounts.
export function useGlobalSkills() {
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setAll([]);
		setLoading(true);
		invoke<SkillInfo[]>("list_global_skills")
			.then(setAll)
			.catch((e) => {
				setAll([]);
				toastError("Could not load global skills", e);
			})
			.finally(() => setLoading(false));
	}, []);

	return { all, loading };
}
