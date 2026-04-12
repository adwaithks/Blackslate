import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// Load the file at `path` whenever it changes (for the preview pane).
export function useReadSkillFile(path: string) {
	const [content, setContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setLoading(true);
		invoke<string | null>("read_skill_content", { path })
			.then((c) => setContent(c ?? null))
			.catch(() => setContent(null))
			.finally(() => setLoading(false));
	}, [path]);

	return { content, loading };
}
