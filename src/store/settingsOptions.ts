/**
 * Static option lists for the Settings UI and their id types.
 * The Zustand store (`settings.ts`) holds the selected ids; this file has no runtime state.
 */

// ─── Terminal themes ──────────────────────────────────────────────────────────

export type TerminalThemeId =
	| "gruvboxDark"
	| "dracula"
	| "tokyoNight"
	| "nord"
	| "solarizedDark";

export interface TerminalThemeOption {
	id: TerminalThemeId;
	label: string;
	preview: { bg: string; fg: string; accent: string };
}

export const TERMINAL_THEME_OPTIONS: TerminalThemeOption[] = [
	{
		id: "gruvboxDark",
		label: "Gruvbox Dark",
		preview: { bg: "#1d2021", fg: "#ebdbb2", accent: "#fabd2f" }, // warm amber
	},
	{
		id: "tokyoNight",
		label: "Tokyo Night",
		preview: { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7" }, // deep blue
	},
	{
		id: "dracula",
		label: "Dracula",
		preview: { bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" }, // vivid purple
	},
	{
		id: "nord",
		label: "Nord",
		preview: { bg: "#2e3440", fg: "#d8dee9", accent: "#88c0d0" }, // arctic blue
	},
	{
		id: "solarizedDark",
		label: "Solarized Dark",
		preview: { bg: "#002b36", fg: "#839496", accent: "#268bd2" }, // teal base, blue accent
	},
];

// ─── Sidebar colours ──────────────────────────────────────────────────────────

export type SidebarColorId =
	| "void"
	| "carbon"
	| "ember"
	| "aurora"
	| "deep-sea"
	| "toxic"
	| "dusk"
	| "crimson"
	| "rose"
	| "slate";

export interface SidebarColorOption {
	id: SidebarColorId;
	label: string;
	value: string; // CSS color applied to --chrome-sidebar-surface
}

export const SIDEBAR_COLOR_OPTIONS: SidebarColorOption[] = [
	// Pure & neutral
	{ id: "void", label: "Void", value: "#00000090" },
	{ id: "carbon", label: "Carbon", value: "#060606" },
	{ id: "ember", label: "Ember", value: "#120a00e0" },
	// Cool
	{ id: "aurora", label: "Aurora", value: "#050d1ae0" },
	{ id: "deep-sea", label: "Deep Sea", value: "#021014e0" },
	// Vivid-dark
	{ id: "toxic", label: "Toxic", value: "#061200e0" },
	{ id: "dusk", label: "Dusk", value: "#0e0518e0" },
	// Warm
	{ id: "crimson", label: "Crimson", value: "#140005e0" },
	{ id: "rose", label: "Rose", value: "#1a0510e0" },
	{ id: "slate", label: "Slate", value: "#0a0d12e0" },
];
