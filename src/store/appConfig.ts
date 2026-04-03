/**
 * User preferences persisted in localStorage (`blackslate-settings`).
 * Appearance option lists live in `appconfig.constants.ts`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AppThemeId, TerminalThemeId } from "@/appconfig.constants";

export type {
	AppThemeId,
	AppThemeOption,
	TerminalThemeId,
	TerminalThemeOption,
} from "@/appconfig.constants";
export {
	APP_THEME_OPTIONS,
	TERMINAL_THEME_OPTIONS,
	appThemeValue,
} from "@/appconfig.constants";

export const DEFAULT_FONT_SIZE = 13;
export const MIN_FONT_SIZE = 5;
export const MAX_FONT_SIZE = 32;
export const FONT_SIZE_STEP = 1;

interface AppConfigStore {
	fontSize: number;
	terminalTheme: TerminalThemeId;
	appTheme: AppThemeId;

	increaseFontSize: () => void;
	decreaseFontSize: () => void;
	setTerminalTheme: (id: TerminalThemeId) => void;
	setAppTheme: (id: AppThemeId) => void;
}

const LEGACY_THEME_MAP: Record<string, TerminalThemeId> = {
	gruvboxDark: "gruvbox",
	oneDark: "one",
	solarizedDark: "solarized",
	gruvboxLight: "gruvbox",
	solarizedLight: "solarized",
	oneLight: "one",
};

export const useAppConfigStore = create<AppConfigStore>()(
	persist(
		(set) => ({
			fontSize: DEFAULT_FONT_SIZE,
			terminalTheme: "gruvbox",
			appTheme: "void",

			increaseFontSize() {
				set((s) => ({
					fontSize: Math.min(
						s.fontSize + FONT_SIZE_STEP,
						MAX_FONT_SIZE,
					),
				}));
			},
			decreaseFontSize() {
				set((s) => ({
					fontSize: Math.max(
						s.fontSize - FONT_SIZE_STEP,
						MIN_FONT_SIZE,
					),
				}));
			},
			setTerminalTheme(id) {
				set({ terminalTheme: id });
			},
			setAppTheme(id) {
				set({ appTheme: id });
			},
		}),
		{
			// rename sidebarColor to appTheme
			// normalize terminal theme names eg: oneDark -> one
			name: "blackslate-settings",
			version: 2,
			migrate: (persisted, fromVersion) => {
				const s = persisted as Record<string, unknown>;
				if (fromVersion < 2) {
					if ("sidebarColor" in s && s.appTheme === undefined) {
						s.appTheme = s.sidebarColor;
						delete s.sidebarColor;
					}
				}
				const old = s.terminalTheme as string | undefined;
				if (old && old in LEGACY_THEME_MAP) {
					s.terminalTheme = LEGACY_THEME_MAP[old];
				}
				return s as unknown as AppConfigStore;
			},
		},
	),
);
