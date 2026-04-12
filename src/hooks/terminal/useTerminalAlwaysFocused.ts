import { useEffect } from "react";
import { requestActiveTerminalFocus } from "@/lib/focusActiveTerminal";

// After you click empty chrome (title bar, sidebar blank area), keep typing in the terminal.
// We block the click from stealing focus, then ask the visible terminal to focus.
// Real controls (fields, buttons, links) and clicks inside the terminal itself still behave normally.

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
