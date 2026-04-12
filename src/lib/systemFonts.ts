// Ask the page which monospace font is configured so the terminal matches the app.
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
