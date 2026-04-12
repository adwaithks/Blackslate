import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { selectActiveTerminal, useTerminalStore } from "@/store/terminals";

function shellEscapePosix(path: string): string {
	// Safe for sh/bash/zsh: wrap in single quotes, escape inner single quotes.
	// foo'bar -> 'foo'"'"'bar'
	return `'${path.replace(/'/g, `'\"'\"'`)}'`;
}

// Dropping files onto the window pastes their full paths into the terminal you're using.
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

				const active = selectActiveTerminal(useTerminalStore.getState());
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

