import * as terminalThemes from "@/lib/terminalThemes";
import { isLightSurface } from "@/lib/colorUtils";

type ThemeFn = (bg?: string) => import("@xterm/xterm").ITheme;

function clamp01(x: number): number {
	return Math.max(0, Math.min(1, x));
}

function withMinAlpha(hex: string, minAlpha: number): string {
	// Accept #RRGGBB or #RRGGBBAA. Return #RRGGBBAA.
	// If the value has no alpha, treat it as fully opaque (no change needed).
	if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 9)) return hex;
	if (hex.length === 7) return hex;
	const a = parseInt(hex.slice(7, 9), 16) / 255;
	const nextA = Math.max(a, clamp01(minAlpha));
	const aa = Math.round(nextA * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex.slice(0, 7)}${aa}`;
}

/** Each user-facing id maps to a dark and light function from terminalThemes. */
const THEME_PAIR: Record<string, { dark: ThemeFn; light: ThemeFn }> = {
	gruvbox:   { dark: terminalThemes.gruvboxDark,   light: terminalThemes.gruvboxLight },
	dracula:   { dark: terminalThemes.dracula,       light: terminalThemes.oneLight },
	tokyoNight:{ dark: terminalThemes.tokyoNight,    light: terminalThemes.oneLight },
	nord:      { dark: terminalThemes.nord,          light: terminalThemes.solarizedLight },
	one:       { dark: terminalThemes.oneDark,       light: terminalThemes.oneLight },
	solarized: { dark: terminalThemes.solarizedDark, light: terminalThemes.solarizedLight },
};

const DEFAULT_PAIR = THEME_PAIR.gruvbox;

/** Maps user-facing theme id + surface → full `ITheme`. Light/dark is automatic. */
export function resolveTerminalTheme(themeId: string, background: string) {
	const pair = THEME_PAIR[themeId] ?? DEFAULT_PAIR;
	const fn = isLightSurface(background) ? pair.light : pair.dark;
	const theme = fn(background);
	// Light themes often use translucent #RRGGBBAA; bump alpha so selection reads.
	// Dark themes use opaque near-white (#RRGGBB) — `withMinAlpha` is a no-op for those.
	if (theme.selectionBackground) {
		theme.selectionBackground = withMinAlpha(theme.selectionBackground, 0.45);
	}
	// WebGL renderer uses selectionInactive* when the terminal isn’t focused (e.g. after
	// clicking the sidebar). Without this, xterm falls back to a dim gray/purple tint.
	if (theme.selectionBackground && theme.selectionInactiveBackground === undefined) {
		theme.selectionInactiveBackground = theme.selectionBackground;
	}
	return theme;
}
