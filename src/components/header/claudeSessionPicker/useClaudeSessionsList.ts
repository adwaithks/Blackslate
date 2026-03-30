import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeSession } from "./types";

/**
 * Loads `list_claude_sessions` when the picker opens; clears cached rows when `cwd`
 * changes so the next open does not flash stale rows from another directory.
 */
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
