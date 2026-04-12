// Turn one chosen chrome color into the rest of the app's colors (hex strings in and out).

const APP_BG_R = 0x06;
const APP_BG_G = 0x06;
const APP_BG_B = 0x06;

export interface RGB {
	r: number;
	g: number;
	b: number;
}

// Read a #RGB hex (with optional transparency) and return solid red/green/blue numbers.
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

// Pack red/green/blue into a #hex color.
export function rgbToHex({ r, g, b }: RGB): string {
	const h = (v: number) => v.toString(16).padStart(2, "0");
	return `#${h(r)}${h(g)}${h(b)}`;
}

// Nudge each channel brighter, capped at white.
export function lighten({ r, g, b }: RGB, amount: number): RGB {
	const c = (v: number) => Math.min(255, v + amount);
	return { r: c(r), g: c(g), b: c(b) };
}

// Nudge each channel darker, capped at black.
export function darken({ r, g, b }: RGB, amount: number): RGB {
	const c = (v: number) => Math.max(0, v - amount);
	return { r: c(r), g: c(g), b: c(b) };
}

// How bright a color reads to the eye (used to pick text color and "light vs dark" mode).
export function luminance({ r, g, b }: RGB): number {
	const f = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// If a background is brighter than this, we treat the UI as "light theme" styling.
export const LIGHT_SURFACE_THRESHOLD = 0.18;

// Whether the chosen base background counts as light (affects text and terminal pairing).
export function isLightSurface(baseHex: string): boolean {
	return luminance(parseHexToOpaque(baseHex)) > LIGHT_SURFACE_THRESHOLD;
}

// From one base color, fill in background, text, borders, cards, terminal strip, etc.
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
