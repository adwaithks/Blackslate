import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types — add new shortcuts by extending the list passed to useAppShortcuts.
// ---------------------------------------------------------------------------

export interface ShortcutDefinition {
	/** Stable id for debugging / future settings UI */
	id: string;
	/** Return true when this binding should handle the event (incl. modifiers). */
	when: (e: KeyboardEvent) => boolean;
	run: () => void;
}

// ---------------------------------------------------------------------------
// Modifiers — macOS Cmd (`metaKey`) or Ctrl (Windows/Linux)
// ---------------------------------------------------------------------------

/** Primary accelerator: ⌘ on macOS, Ctrl elsewhere (both accepted). */
export function modPrimary(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey;
}

/** ⌘/Ctrl + letter, no Shift/Alt (avoids clashing with shifted symbols). */
export function modLetter(e: KeyboardEvent, letter: string): boolean {
	const ch = letter.length === 1 ? letter.toLowerCase() : letter;
	return (
		modPrimary(e) &&
		!e.altKey &&
		!e.shiftKey &&
		e.key.length === 1 &&
		e.key.toLowerCase() === ch
	);
}

export function zoomInKeys(e: KeyboardEvent): boolean {
	return modPrimary(e) && !e.altKey && (e.key === "=" || e.key === "+");
}

export function zoomOutKey(e: KeyboardEvent): boolean {
	return modPrimary(e) && !e.altKey && e.key === "-";
}

/** ⌘/Ctrl + a main-row digit (1–9), no Shift/Alt. Returns the digit or null. */
export function modDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || e.altKey || e.shiftKey) return null;
	if (e.key < "1" || e.key > "9") return null;
	return e.key.charCodeAt(0) - 48;
}

/**
 * ⌘/Ctrl + ⌥ + digit (1–9) — for workspace switching without clashing with
 * {@link modDigitKey} (session tabs).
 */
export function modOptionDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || !e.altKey || e.shiftKey) return null;
	if (e.key < "1" || e.key > "9") return null;
	return e.key.charCodeAt(0) - 48;
}

/** ⌘/Ctrl + [ or ] (no Shift/Alt). Uses `code` for reliable layout mapping. */
export function modBracketKey(
	e: KeyboardEvent,
	which: "left" | "right",
): boolean {
	if (!modPrimary(e) || e.altKey || e.shiftKey) return false;
	return which === "left"
		? e.code === "BracketLeft"
		: e.code === "BracketRight";
}

// ---------------------------------------------------------------------------
// Focus — allow shortcuts while xterm is focused (textarea helper)
// ---------------------------------------------------------------------------

export function isInsideTerminal(target: EventTarget | null): boolean {
	if (!target || !(target instanceof Element)) return false;
	return Boolean(target.closest(".xterm"));
}

/** Skip when typing in real form fields; never skip inside the terminal surface. */
export function shouldIgnoreShortcutTarget(e: KeyboardEvent): boolean {
	if (isInsideTerminal(e.target)) return false;
	const el = e.target;
	if (!(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return false;
}

// ---------------------------------------------------------------------------
// Hook — register on window capture so PTY / xterm does not see the key.
// ---------------------------------------------------------------------------

/**
 * Register global app shortcuts. Pass a factory so handlers always read fresh state.
 * Uses capture phase + stopPropagation so the terminal does not receive the key.
 */
export function useAppShortcuts(getDefs: () => ShortcutDefinition[]): void {
	const getDefsRef = useRef(getDefs);
	getDefsRef.current = getDefs;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (shouldIgnoreShortcutTarget(e)) return;

			for (const def of getDefsRef.current()) {
				if (def.when(e)) {
					e.preventDefault();
					e.stopPropagation();
					def.run();
					return;
				}
			}
		};

		window.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			window.removeEventListener("keydown", onKeyDown, { capture: true });
	}, []);
}
