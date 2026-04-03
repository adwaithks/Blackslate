/**
 * Minimal color math for deriving the app theme from a single base chrome colour.
 * All inputs/outputs are hex strings (#RRGGBB or #RRGGBBAA).
 */

const APP_BG_R = 0x06;
const APP_BG_G = 0x06;
const APP_BG_B = 0x06;

export interface RGB {
	r: number;
	g: number;
	b: number;
}

/** Parse #RRGGBB or #RRGGBBAA → { r, g, b } (0-255), alpha-composited over app bg. */
export function parseHexToOpaque(hex: string): RGB {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;

	return {
		r: Math.round(r * a + APP_BG_R * (1 - a)),
		g: Math.round(g * a + APP_BG_G * (1 - a)),
		b: Math.round(b * a + APP_BG_B * (1 - a)),
	};
}

/** RGB → #rrggbb */
export function rgbToHex({ r, g, b }: RGB): string {
	const h = (v: number) => v.toString(16).padStart(2, "0");
	return `#${h(r)}${h(g)}${h(b)}`;
}

/** Lighten an RGB by `amount` (0-255), clamped. */
export function lighten({ r, g, b }: RGB, amount: number): RGB {
	const c = (v: number) => Math.min(255, v + amount);
	return { r: c(r), g: c(g), b: c(b) };
}

/** Darken an RGB by `amount` (0-255), clamped. */
export function darken({ r, g, b }: RGB, amount: number): RGB {
	const c = (v: number) => Math.max(0, v - amount);
	return { r: c(r), g: c(g), b: c(b) };
}

/** Relative luminance (WCAG 2.0). */
export function luminance({ r, g, b }: RGB): number {
	const f = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Surfaces above this luminance are treated as "light" for theme derivation. */
export const LIGHT_SURFACE_THRESHOLD = 0.18;

/** True when the resolved app theme base colour is a "light" surface. */
export function isLightSurface(baseHex: string): boolean {
	return luminance(parseHexToOpaque(baseHex)) > LIGHT_SURFACE_THRESHOLD;
}

/**
 * Derive the full set of theme CSS variables from a single base hex colour.
 * Returns a record of CSS property name → value string.
 *
 * Elevation ladder (dark mode, darkest → lightest):
 *   terminal (−4) < background (base) < card (+6) < border (+8)
 *   < muted (+12) < popover (+14) < accent (+16) < ring (+35)
 */
export function deriveThemeVars(baseHex: string): Record<string, string> {
	const base = parseHexToOpaque(baseHex);
	const backgroundHex = rgbToHex(base);
	const isLight = luminance(base) > LIGHT_SURFACE_THRESHOLD;

	const fg = isLight ? "#0a0a0a" : "#f5f5f5";
	const fgMuted = isLight ? "#555555" : "#a0a0a0";

	const terminal = rgbToHex(isLight ? lighten(base, 4) : darken(base, 4));
	const card     = rgbToHex(isLight ? lighten(base, 5) : lighten(base, 6));
	const border   = rgbToHex(isLight ? darken(base, 20) : lighten(base, 8));
	const input    = border;
	const muted    = rgbToHex(isLight ? darken(base, 10) : lighten(base, 12));
	const popover  = rgbToHex(isLight ? lighten(base, 5) : lighten(base, 14));
	const accent   = rgbToHex(isLight ? darken(base, 15) : lighten(base, 16));
	const ring     = rgbToHex(isLight ? darken(base, 30) : lighten(base, 35));

	return {
		"--terminal": terminal,
		"--background": backgroundHex,
		"--foreground": fg,
		"--card": card,
		"--card-foreground": fg,
		"--popover": popover,
		"--popover-foreground": fg,
		"--primary": fg,
		"--primary-foreground": backgroundHex,
		"--secondary": muted,
		"--secondary-foreground": fg,
		"--muted": muted,
		"--muted-foreground": fgMuted,
		"--accent": accent,
		"--accent-foreground": fg,
		"--border": border,
		"--input": input,
		"--ring": ring,
		"--sidebar-foreground": fg,
		"--sidebar-accent-foreground": fg,
		"--sidebar-primary-foreground": fg,
		"--sidebar-accent": accent,
		"--sidebar-border": border,
		"--sidebar-ring": ring,
	};
}
