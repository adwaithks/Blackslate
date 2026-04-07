import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { selectActiveSession, useSessionStore } from "@/store/sessions";

function shellEscapePosix(path: string): string {
	// Safe for sh/bash/zsh: wrap in single quotes, escape inner single quotes.
	// foo'bar -> 'foo'"'"'bar'
	return `'${path.replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * When files are dropped onto the Tauri webview, insert their absolute paths
 * into the active terminal as if typed.
 */
export function useTerminalFileDropToPty(): void {
	useEffect(() => {
		let cancelled = false;
		let unlisten: (() => void) | undefined;

		const setup = async () => {
			const webview = getCurrentWebview();
			unlisten = await webview.onDragDropEvent(async (event) => {
				if (cancelled) return;
				if (event.payload.type !== "drop") return;
				const paths = event.payload.paths;
				if (!paths || paths.length === 0) return;

				const active = selectActiveSession(useSessionStore.getState());
				const ptyId = active?.ptyId;
				if (!ptyId) return;

				const escaped = paths.map(shellEscapePosix).join(" ");
				// Leading/trailing space matches typical terminal behavior.
				await invoke("pty_write", { id: ptyId, data: ` ${escaped} ` });
			});
		};

		void setup().catch((e) => {
			// Non-fatal: drag/drop is an enhancement.
			console.error("[terminal] file drop hook failed", e);
		});

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, []);
}

