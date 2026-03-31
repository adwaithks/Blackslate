/** Dispatched when chrome (e.g. header Select) should yield focus to the active xterm. */
export const FOCUS_ACTIVE_TERMINAL_EVENT = "blackslate:focus-active-terminal";

export function requestActiveTerminalFocus(): void {
	window.dispatchEvent(new CustomEvent(FOCUS_ACTIVE_TERMINAL_EVENT));
}
