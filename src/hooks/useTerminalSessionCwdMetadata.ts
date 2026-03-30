import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	useSessionStore,
	type GitInfo,
	type ProjectStackItem,
} from "@/store/sessions";

/**
 * Keeps sidebar git line + project stack in sync with OSC 7 cwd for this session.
 * Two separate Tauri calls — failures clear that slice so the UI doesn’t lie.
 */
export function useTerminalSessionCwdMetadata(sessionId: string, cwd: string) {
	const setGit = useSessionStore((s) => s.setGit);
	const setProjectStack = useSessionStore((s) => s.setProjectStack);

	useEffect(() => {
		invoke<GitInfo | null>("git_info", { cwd })
			.then((git) => setGit(sessionId, git))
			.catch(() => setGit(sessionId, null));
	}, [cwd, sessionId, setGit]);

	useEffect(() => {
		invoke<ProjectStackItem[]>("project_stack", { cwd })
			.then((stack) => setProjectStack(sessionId, stack))
			.catch(() => setProjectStack(sessionId, []));
	}, [cwd, sessionId, setProjectStack]);
}
