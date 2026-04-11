import { useEffect } from "react";
import { requestActiveTerminalFocus } from "@/lib/focusActiveTerminal";

/**
 * Keeps the active terminal focused at all times. When the user clicks on
 * non-interactive chrome (titlebar, sidebar background, etc.) this hook:
 *   1. Calls `preventDefault()` on the mousedown to prevent the browser from
 *      moving focus away from the terminal.
 *   2. Dispatches `requestActiveTerminalFocus()` so the xterm surface receives
 *      focus even if it didn't have it yet.
 *
 * Clicks on genuinely interactive elements (inputs, buttons, selects, links,
 * contenteditable nodes) and clicks inside xterm itself are left untouched so
 * those elements work normally.
 */

const INTERACTIVE_SELECTOR =
	'input, textarea, select, button, a[href], [contenteditable], [tabindex]:not([tabindex="-1"])';

export function useTerminalAlwaysFocused() {
	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => {
			const target = e.target as Element;

			// Let xterm handle its own mouse events (text selection, cursor placement).
			if (target.closest(".xterm")) return;

			// Let interactive elements receive focus normally.
			if (target.closest(INTERACTIVE_SELECTOR)) return;

			// For all other clicks (chrome, backgrounds, decorations): prevent focus
			// from leaving the terminal and explicitly re-focus it.
			e.preventDefault();
			requestActiveTerminalFocus();
		};

		document.addEventListener("mousedown", onMouseDown);
		return () => document.removeEventListener("mousedown", onMouseDown);
	}, []);
}
