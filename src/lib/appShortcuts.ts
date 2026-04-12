import { useEffect, useRef } from "react";
import { toastError } from "@/lib/toastError";

// Add shortcuts by putting more entries in the list you pass to useAppShortcuts.

export interface ShortcutDefinition {
	// Short name for logs or a future settings screen.
	id: string;
	// True when this shortcut should run for this key press (including modifiers).
	when: (e: KeyboardEvent) => boolean;
	run: () => void | Promise<void>;
}

// Modifier helpers: Command on Mac, Control on Windows/Linux (we accept both where noted).

// Command on Mac, or Control on other systems.
export function modPrimary(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey;
}

// Command or Control plus a letter, without Shift or Alt. Uses the physical key so layouts do not confuse us.
export function modLetter(e: KeyboardEvent, letter: string): boolean {
	const upper = letter.length === 1 ? letter.toUpperCase() : letter;
	const code = `Key${upper}`;
	return modPrimary(e) && !e.altKey && !e.shiftKey && e.code === code;
}

// Command + letter only (no Control), so Control+keys can stay with the shell.
export function cmdLetter(e: KeyboardEvent, letter: string): boolean {
	const upper = letter.length === 1 ? letter.toUpperCase() : letter;
	const code = `Key${upper}`;
	return (
		e.metaKey &&
		!e.ctrlKey &&
		!e.altKey &&
		!e.shiftKey &&
		e.code === code
	);
}

// Command or Control + Shift + letter, no Alt.
export function modShiftLetter(e: KeyboardEvent, letter: string): boolean {
	const upper = letter.length === 1 ? letter.toUpperCase() : letter;
	const code = `Key${upper}`;
	return modPrimary(e) && e.shiftKey && !e.altKey && e.code === code;
}

export function zoomInKeys(e: KeyboardEvent): boolean {
	return (
		modPrimary(e) &&
		!e.altKey &&
		(e.code === "Equal" || e.code === "NumpadAdd")
	);
}

export function zoomOutKey(e: KeyboardEvent): boolean {
	return (
		modPrimary(e) &&
		!e.altKey &&
		(e.code === "Minus" || e.code === "NumpadSubtract")
	);
}

// Command or Control + digit 1–9 on the main row. Returns that digit or null.
export function modDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || e.altKey || e.shiftKey) return null;
	const m = /^Digit([1-9])$/.exec(e.code);
	return m ? Number(m[1]) : null;
}

// Command or Control + Option + digit 1–9 (used so it does not clash with plain number keys for tabs).
export function modOptionDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || !e.altKey || e.shiftKey) return null;
	const m = /^Digit([1-9])$/.exec(e.code);
	return m ? Number(m[1]) : null;
}

// Command or Control + [ or ], no Shift or Alt.
export function modBracketKey(
	e: KeyboardEvent,
	which: "left" | "right",
): boolean {
	if (!modPrimary(e) || e.altKey || e.shiftKey) return false;
	return which === "left"
		? e.code === "BracketLeft"
		: e.code === "BracketRight";
}

// Focus: still run shortcuts when the fake terminal is focused (it uses a hidden field).

export function isInsideTerminal(target: EventTarget | null): boolean {
	if (!target || !(target instanceof Element)) return false;
	return Boolean(target.closest(".xterm"));
}

// Ignore keys typed into real inputs; never ignore the terminal area.
export function shouldIgnoreShortcutTarget(e: KeyboardEvent): boolean {
	if (isInsideTerminal(e.target)) return false;
	const el = e.target;
	if (!(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return false;
}

// Register shortcuts on the document in capture phase so the terminal never sees them.

// Pass a function that returns the list so each press sees up-to-date handlers.
export function useAppShortcuts(getDefs: () => ShortcutDefinition[]): void {
	const getDefsRef = useRef(getDefs);
	getDefsRef.current = getDefs;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat) {
				return;
			}
			if (shouldIgnoreShortcutTarget(e)) {
				return;
			}

			const defs = getDefsRef.current();
			for (const def of defs) {
				if (def.when(e)) {
					e.preventDefault();
					e.stopPropagation();
					void Promise.resolve(def.run()).catch((e) =>
						toastError("Shortcut action failed", e),
					);
					return;
				}
			}

		};

		document.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			document.removeEventListener("keydown", onKeyDown, {
				capture: true,
			});
	}, []);
}
