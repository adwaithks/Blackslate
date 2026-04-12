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

// Settings menu name → pair of dark and light terminal palettes.
const THEME_PAIR: Record<string, { dark: ThemeFn; light: ThemeFn }> = {
	gruvbox:   { dark: terminalThemes.gruvboxDark,   light: terminalThemes.gruvboxLight },
	dracula:   { dark: terminalThemes.dracula,       light: terminalThemes.oneLight },
	tokyoNight:{ dark: terminalThemes.tokyoNight,    light: terminalThemes.oneLight },
	nord:      { dark: terminalThemes.nord,          light: terminalThemes.solarizedLight },
	one:       { dark: terminalThemes.oneDark,       light: terminalThemes.oneLight },
	solarized: { dark: terminalThemes.solarizedDark, light: terminalThemes.solarizedLight },
};

const DEFAULT_PAIR = THEME_PAIR.gruvbox;

// Pick the full terminal colors from a menu id and the current background (auto light vs dark).
export function resolveTerminalTheme(themeId: string, background: string) {
	const pair = THEME_PAIR[themeId] ?? DEFAULT_PAIR;
	const fn = isLightSurface(background) ? pair.light : pair.dark;
	const theme = fn(background);
	// Light palettes sometimes use see-through highlight colors; make them solid enough to read.
	if (theme.selectionBackground) {
		theme.selectionBackground = withMinAlpha(theme.selectionBackground, 0.45);
	}
	// When you click away, use the same highlight so selection doesn't turn a muddy default color.
	if (theme.selectionBackground && theme.selectionInactiveBackground === undefined) {
		theme.selectionInactiveBackground = theme.selectionBackground;
	}
	return theme;
}
