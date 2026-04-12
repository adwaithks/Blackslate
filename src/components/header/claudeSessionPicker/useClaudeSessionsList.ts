import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeSession } from "./types";

// Fetch session history when the picker opens. Clear the list when the folder changes so you don't see the wrong project's sessions.
export function useClaudeSessionsList(open: boolean, cwd: string) {
	const [sessions, setSessions] = useState<ClaudeSession[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setLoading(true);
		invoke<ClaudeSession[]>("list_claude_sessions", { cwd })
			.then((data) => {
				setSessions(data);
			})
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [open, cwd]);

	useEffect(() => {
		setSessions([]);
	}, [cwd]);

	return { sessions, loading };
}
