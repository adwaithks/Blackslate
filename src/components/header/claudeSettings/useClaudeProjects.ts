import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toastError } from "@/lib/toastError";
import type { ClaudeProject } from "./types";

// Load known assistant projects once for the project dropdown.
export function useClaudeProjects() {
	const [projects, setProjects] = useState<ClaudeProject[]>([]);

	useEffect(() => {
		invoke<ClaudeProject[]>("list_claude_projects")
			.then(setProjects)
			.catch((e) => {
				setProjects([]);
				toastError("Could not load Claude projects", e);
			});
	}, []);

	return projects;
}
