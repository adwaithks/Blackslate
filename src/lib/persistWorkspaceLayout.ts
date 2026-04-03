/**
 * Writes workspace layout to disk via Tauri. Uses a registered getter to avoid a
 * circular import with `sessionsStore`.
 */

import { invoke } from "@tauri-apps/api/core";

import type { SessionState } from "@/store/sessionsTypes";
import { serializeWorkspaceLayout } from "@/lib/workspaceLayoutSnapshot";

let getSessionLayoutSlice: () => SessionState = () => ({
	workspaces: [],
	activeWorkspaceId: "",
});

/** Called once from `sessionsStore` after `useSessionStore` is created. */
export function registerWorkspaceLayoutGetter(getter: () => SessionState): void {
	getSessionLayoutSlice = getter;
}

/** Await before app exit so the final layout is on disk (no microtask delay). */
export async function flushWorkspaceLayoutNow(): Promise<void> {
	const state = getSessionLayoutSlice();
	if (state.workspaces.length === 0) return;
	const content = serializeWorkspaceLayout(state);
	await invoke("workspace_snapshot_write", { content });
}

/**
 * Persist after discrete user actions (tab/workspace close or rename).
 * Microtask batches multiple sync `set` calls in the same turn.
 */
export function scheduleFlushWorkspaceLayout(): void {
	queueMicrotask(() => {
		void flushWorkspaceLayoutNow().catch((e) => {
			console.error("[workspace layout] persist failed", e);
		});
	});
}
