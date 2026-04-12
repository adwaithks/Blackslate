import { WebLinksAddon } from "@xterm/addon-web-links";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Terminal } from "@xterm/xterm";
import { toastError } from "@/lib/toastError";

// Official xterm link addon; opens URLs in the system browser (Tauri).
export function attachTerminalUrlLinking(term: Terminal): void {
	term.loadAddon(
		new WebLinksAddon((_event, uri) => {
			openUrl(uri).catch((e) => toastError("Could not open link", e));
		}),
	);
}
