import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 32;
const STEP = 1;

// ─── Terminal themes ──────────────────────────────────────────────────────────

export type TerminalThemeId = "gruvboxDark" | "dracula" | "tokyoNight" | "nord";

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
	{ id: "void",     label: "Void",       value: "#00000090" }, // pure black, semi-transparent
	{ id: "carbon",   label: "Carbon",     value: "#0f0f0f"   }, // near-black neutral
	{ id: "ember",    label: "Ember",      value: "#120a00e0" }, // deep amber-black — pairs with Gruvbox
	// Cool
	{ id: "aurora",   label: "Aurora",     value: "#050d1ae0" }, // near-black navy — pairs with Nord
	{ id: "deep-sea", label: "Deep Sea",   value: "#021014e0" }, // dark teal-black
	// Vivid-dark
	{ id: "toxic",    label: "Toxic",      value: "#061200e0" }, // near-black electric green
	{ id: "dusk",     label: "Dusk",       value: "#0e0518e0" }, // deep violet — pairs with Dracula
	// Warm
	{ id: "crimson",  label: "Crimson",    value: "#140005e0" }, // near-black red
	{ id: "rose",     label: "Rose",       value: "#1a0510e0" }, // deep rose-pink
	{ id: "slate",    label: "Slate",      value: "#0a0d12e0" }, // dark blue-gray
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface SettingsStore {
	fontSize: number;
	terminalTheme: TerminalThemeId;
	sidebarColor: SidebarColorId;

	increaseFontSize: () => void;
	decreaseFontSize: () => void;
	setTerminalTheme: (id: TerminalThemeId) => void;
	setSidebarColor: (id: SidebarColorId) => void;
}

export const useSettingsStore = create<SettingsStore>()(
	persist(
		(set) => ({
			fontSize: DEFAULT_FONT_SIZE,
			terminalTheme: "gruvboxDark",
			sidebarColor: "void",

			increaseFontSize() {
				set((s) => ({
					fontSize: Math.min(s.fontSize + STEP, MAX_FONT_SIZE),
				}));
			},
			decreaseFontSize() {
				set((s) => ({
					fontSize: Math.max(s.fontSize - STEP, MIN_FONT_SIZE),
				}));
			},
			setTerminalTheme(id) {
				set({ terminalTheme: id });
			},
			setSidebarColor(id) {
				set({ sidebarColor: id });
			},
		}),
		{ name: "blackslate-settings" },
	),
);
