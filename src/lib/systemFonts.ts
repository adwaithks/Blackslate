/**
 * Reads font stacks from CSS (`@theme` in index.css) so xterm matches the rest of the app.
 */
const GEIST_MONO_STACK = '"Geist Mono Variable", ui-monospace, monospace';

export function getThemeFont(
	property: "--font-sans" | "--font-mono",
): string {
	if (typeof document === "undefined") {
		return GEIST_MONO_STACK;
	}
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue(property)
		.trim();
	if (raw) return raw;
	return GEIST_MONO_STACK;
}
