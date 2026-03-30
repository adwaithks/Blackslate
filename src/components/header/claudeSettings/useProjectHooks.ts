import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HookInfo } from "./types";

/** `list_project_hooks` when a project is selected (hooks → project). */
export function useProjectHooks(projectPath: string | null) {
	const [hooks, setHooks] = useState<HookInfo[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!projectPath) return;
		setHooks([]);
		setLoading(true);
		invoke<HookInfo[]>("list_project_hooks", { projectPath })
			.then(setHooks)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [projectPath]);

	return { hooks, loading };
}
