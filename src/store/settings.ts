/**
 * User preferences persisted in localStorage (`blackslate-settings`).
 * Option lists live in `settingsOptions.ts`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SidebarColorId, TerminalThemeId } from "@/store/settingsOptions";

export type { SidebarColorId, SidebarColorOption, TerminalThemeId, TerminalThemeOption } from "@/store/settingsOptions";
export { SIDEBAR_COLOR_OPTIONS, TERMINAL_THEME_OPTIONS, sidebarColorValue } from "@/store/settingsOptions";

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 32;
const STEP = 1;

interface SettingsStore {
	fontSize: number;
	terminalTheme: TerminalThemeId;
	sidebarColor: SidebarColorId;

	increaseFontSize: () => void;
	decreaseFontSize: () => void;
	setTerminalTheme: (id: TerminalThemeId) => void;
	setSidebarColor: (id: SidebarColorId) => void;
}

const LEGACY_THEME_MAP: Record<string, TerminalThemeId> = {
	gruvboxDark: "gruvbox",
	oneDark: "one",
	solarizedDark: "solarized",
	gruvboxLight: "gruvbox",
	solarizedLight: "solarized",
	oneLight: "one",
};

export const useSettingsStore = create<SettingsStore>()(
	persist(
		(set) => ({
			fontSize: DEFAULT_FONT_SIZE,
			terminalTheme: "gruvbox",
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
		{
			name: "blackslate-settings",
			version: 1,
			migrate: (persisted: unknown) => {
				const s = persisted as Record<string, unknown>;
				const old = s.terminalTheme as string | undefined;
				if (old && old in LEGACY_THEME_MAP) {
					s.terminalTheme = LEGACY_THEME_MAP[old];
				}
				return s as unknown as SettingsStore;
			},
		},
	),
);
