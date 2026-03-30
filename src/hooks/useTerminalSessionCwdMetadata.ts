import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore, type GitInfo } from "@/store/sessions";

/**
 * Keeps sidebar git line in sync with OSC 7 cwd for this session.
 * Failures clear git so the UI doesn’t lie.
 */
export function useTerminalSessionCwdMetadata(sessionId: string, cwd: string) {
	const setGit = useSessionStore((s) => s.setGit);

	useEffect(() => {
		invoke<GitInfo | null>("git_info", { cwd })
			.then((git) => setGit(sessionId, git))
			.catch(() => setGit(sessionId, null));
	}, [cwd, sessionId, setGit]);
}
