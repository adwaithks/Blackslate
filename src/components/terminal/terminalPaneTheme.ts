import * as terminalThemes from "@/lib/terminalThemes";
import { isLightSurface } from "@/lib/colorUtils";

type ThemeFn = (bg?: string) => import("@xterm/xterm").ITheme;

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
	return fn(background);
}
