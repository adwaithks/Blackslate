// Lists of terminal look presets and app chrome colors. The config store remembers picks; this file is just data.

// ─── Terminal themes ──────────────────────────────────────────────────────────

export type TerminalThemeId =
	| "gruvbox"
	| "dracula"
	| "tokyoNight"
	| "nord"
	| "one"
	| "solarized";

export interface TerminalThemeOption {
	id: TerminalThemeId;
	label: string;
	preview: { bg: string; fg: string; accent: string };
}

export const TERMINAL_THEME_OPTIONS: TerminalThemeOption[] = [
	{
		id: "gruvbox",
		label: "Gruvbox",
		preview: { bg: "#1d2021", fg: "#ebdbb2", accent: "#fabd2f" },
	},
	{
		id: "tokyoNight",
		label: "Tokyo Night",
		preview: { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7" },
	},
	{
		id: "dracula",
		label: "Dracula",
		preview: { bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" },
	},
	{
		id: "nord",
		label: "Nord",
		preview: { bg: "#2e3440", fg: "#d8dee9", accent: "#88c0d0" },
	},
	{
		id: "one",
		label: "One",
		preview: { bg: "#000000", fg: "#abb2bf", accent: "#e5c07b" },
	},
	{
		id: "solarized",
		label: "Solarized",
		preview: { bg: "#002b36", fg: "#839496", accent: "#268bd2" },
	},
];

// ─── App chrome colors (one base color → rest of UI is calculated) ─

export type AppThemeId =
	| "void"
	| "slate"
	| "aurora"
	| "ember"
	| "dusk"
	| "bone"
	| "blush"
	| "fog"
	| "pearl";

export interface AppThemeOption {
	id: AppThemeId;
	label: string;
	value: string; // Base color hex; sidebar and related colors derive from it
}

// Look up the hex for a theme id (falls back to the first option).
export function appThemeValue(id: AppThemeId): string {
	return APP_THEME_OPTIONS.find((o) => o.id === id)?.value
		?? APP_THEME_OPTIONS[0].value;
}

export const APP_THEME_OPTIONS: AppThemeOption[] = [
	// Dark
	{ id: "void", label: "Void", value: "#00000090" },
	{ id: "slate", label: "Slate", value: "#0a0d12e0" },
	{ id: "aurora", label: "Aurora", value: "#050d1ae0" },
	{ id: "ember", label: "Ember", value: "#120a00e0" },
	{ id: "dusk", label: "Dusk", value: "#0e0518e0" },
	// Light
	{ id: "bone", label: "Bone", value: "#e8e4df" },
	{ id: "blush", label: "Blush", value: "#ecdde0" },
	{ id: "fog", label: "Fog", value: "#dfe3ea" },
	{ id: "pearl", label: "Pearl", value: "#f0f0f0" },
];
