import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types — add new shortcuts by extending the list passed to useAppShortcuts.
// ---------------------------------------------------------------------------

export interface ShortcutDefinition {
	/** Stable id for debugging / future settings UI */
	id: string;
	/** Return true when this binding should handle the event (incl. modifiers). */
	when: (e: KeyboardEvent) => boolean;
	run: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Modifiers — macOS Cmd (`metaKey`) or Ctrl (Windows/Linux)
// ---------------------------------------------------------------------------

/** Primary accelerator: ⌘ on macOS, Ctrl elsewhere (both accepted). */
export function modPrimary(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey;
}

/**
 * ⌘/Ctrl + letter, no Shift/Alt (avoids clashing with shifted symbols).
 * Uses `e.code` (physical Key*) — `e.key` is unreliable in WKWebView with modifiers
 * and varies by keyboard layout.
 */
export function modLetter(e: KeyboardEvent, letter: string): boolean {
	const upper = letter.length === 1 ? letter.toUpperCase() : letter;
	const code = `Key${upper}`;
	return modPrimary(e) && !e.altKey && !e.shiftKey && e.code === code;
}

/** ⌘/Ctrl + Shift + letter, no Alt. */
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

/** ⌘/Ctrl + a main-row digit (1–9), no Shift/Alt. Returns the digit or null. */
export function modDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || e.altKey || e.shiftKey) return null;
	const m = /^Digit([1-9])$/.exec(e.code);
	return m ? Number(m[1]) : null;
}

/**
 * ⌘/Ctrl + ⌥ + digit (1–9) — for workspace switching without clashing with
 * {@link modDigitKey} (session tabs).
 */
export function modOptionDigitKey(e: KeyboardEvent): number | null {
	if (!modPrimary(e) || !e.altKey || e.shiftKey) return null;
	const m = /^Digit([1-9])$/.exec(e.code);
	return m ? Number(m[1]) : null;
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
			if (e.repeat) {
				console.debug("[shortcuts] skip (repeat)", e.code);
				return;
			}
			if (shouldIgnoreShortcutTarget(e)) {
				const t = e.target;
				const hint =
					t instanceof HTMLElement
						? `${t.tagName}${t.id ? `#${t.id}` : ""}`
						: String(t);
				console.debug("[shortcuts] ignored (focus target)", hint);
				return;
			}

			const defs = getDefsRef.current();
			for (const def of defs) {
				if (def.when(e)) {
					console.debug("[shortcuts] matched", def.id, {
						code: e.code,
						key: e.key,
						meta: e.metaKey,
						shift: e.shiftKey,
						alt: e.altKey,
					});
					e.preventDefault();
					e.stopPropagation();
					void Promise.resolve(def.run()).catch(console.error);
					return;
				}
			}

			if (modPrimary(e)) {
				console.debug("[shortcuts] no match (⌘/Ctrl chord)", {
					code: e.code,
					key: e.key,
					shift: e.shiftKey,
					alt: e.altKey,
				});
			}
		};

		// `document` is more reliable than `window` in some WebViews (WKWebView) for
		// key events when focus is inside the page.
		document.addEventListener("keydown", onKeyDown, { capture: true });
		return () =>
			document.removeEventListener("keydown", onKeyDown, {
				capture: true,
			});
	}, []);
}
