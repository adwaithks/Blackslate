// Custom event name: "give keyboard focus back to the visible terminal."
export const FOCUS_ACTIVE_TERMINAL_EVENT = "blackslate:focus-active-terminal";

export function requestActiveTerminalFocus(): void {
	window.dispatchEvent(new CustomEvent(FOCUS_ACTIVE_TERMINAL_EVENT));
}
