// Font size and light/dark look for the app and for the terminal. Saved in the browser under blackslate-app-config.
// Theme lists live in appconfig.constants.ts.

import { create } from "zustand";
import {
	createJSONStorage,
	persist,
	type StorageValue,
} from "zustand/middleware";

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

export const APP_CONFIG_STORAGE_KEY = "blackslate-app-config";

// Raise this when you change what we save. Older saved files will be ignored.
export const APP_CONFIG_PERSIST_VERSION = 1;

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

const baseJsonStorage = createJSONStorage<AppConfigStore>(() => localStorage);

function persistVersionMatches(parsed: { version?: unknown }): boolean {
	return (
		typeof parsed.version === "number" &&
		parsed.version === APP_CONFIG_PERSIST_VERSION
	);
}

// When reading: only accept our current version; otherwise delete the key and use defaults.
const appConfigPersistStorage = {
	...baseJsonStorage!,
	getItem: (name: string) => {
		const raw = localStorage.getItem(name);
		if (raw === null) return null;
		try {
			const parsed = JSON.parse(raw) as {
				state: unknown;
				version?: number;
			};
			if (!parsed || typeof parsed !== "object" || !("state" in parsed)) {
				localStorage.removeItem(name);
				return null;
			}
			if (!persistVersionMatches(parsed)) {
				localStorage.removeItem(name);
				return null;
			}
			return {
				...parsed,
				state: parsed.state as AppConfigStore,
			} as StorageValue<AppConfigStore>;
		} catch {
			localStorage.removeItem(name);
			return null;
		}
	},
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
			name: APP_CONFIG_STORAGE_KEY,
			version: APP_CONFIG_PERSIST_VERSION,
			storage: appConfigPersistStorage,
		},
	),
);
