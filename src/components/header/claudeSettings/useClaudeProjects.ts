import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeProject } from "./types";

/** `list_claude_projects` once (project picker dropdown). */
export function useClaudeProjects() {
	const [projects, setProjects] = useState<ClaudeProject[]>([]);

	useEffect(() => {
		invoke<ClaudeProject[]>("list_claude_projects")
			.then(setProjects)
			.catch(console.error);
	}, []);

	return projects;
}
