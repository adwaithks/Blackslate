import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	APP_CONFIG_PERSIST_VERSION,
	APP_CONFIG_STORAGE_KEY,
	DEFAULT_FONT_SIZE,
	FONT_SIZE_STEP,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "@/store/appConfig";

type AppConfigModule = typeof import("@/store/appConfig");

let useAppConfigStore: AppConfigModule["useAppConfigStore"];

beforeEach(async () => {
	localStorage.clear();
	vi.resetModules();
	({ useAppConfigStore } = await import("@/store/appConfig"));
	await useAppConfigStore.persist.rehydrate();
});

describe("useAppConfigStore", () => {
	it("starts with default preferences", () => {
		const s = useAppConfigStore.getState();
		expect(s.fontSize).toBe(DEFAULT_FONT_SIZE);
		expect(s.terminalTheme).toBe("gruvbox");
		expect(s.appTheme).toBe("void");
	});

	it("increaseFontSize adds FONT_SIZE_STEP", () => {
		useAppConfigStore.setState({ fontSize: DEFAULT_FONT_SIZE });
		useAppConfigStore.getState().increaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(
			DEFAULT_FONT_SIZE + FONT_SIZE_STEP,
		);
	});

	it("decreaseFontSize subtracts FONT_SIZE_STEP", () => {
		useAppConfigStore.setState({ fontSize: DEFAULT_FONT_SIZE });
		useAppConfigStore.getState().decreaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(
			DEFAULT_FONT_SIZE - FONT_SIZE_STEP,
		);
	});

	it("increaseFontSize reaches MAX_FONT_SIZE from one step below", () => {
		useAppConfigStore.setState({
			fontSize: MAX_FONT_SIZE - FONT_SIZE_STEP,
		});
		useAppConfigStore.getState().increaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(MAX_FONT_SIZE);
	});

	it("decreaseFontSize reaches MIN_FONT_SIZE from one step above", () => {
		useAppConfigStore.setState({
			fontSize: MIN_FONT_SIZE + FONT_SIZE_STEP,
		});
		useAppConfigStore.getState().decreaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(MIN_FONT_SIZE);
	});

	it("does not increase font size above the max", () => {
		useAppConfigStore.setState({ fontSize: MAX_FONT_SIZE });
		useAppConfigStore.getState().increaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(MAX_FONT_SIZE);
	});

	it("does not decrease font size below the min", () => {
		useAppConfigStore.setState({ fontSize: MIN_FONT_SIZE });
		useAppConfigStore.getState().decreaseFontSize();
		expect(useAppConfigStore.getState().fontSize).toBe(MIN_FONT_SIZE);
	});

	it("setTerminalTheme and setAppTheme update ids", () => {
		useAppConfigStore.getState().setTerminalTheme("nord");
		useAppConfigStore.getState().setAppTheme("pearl");
		const s = useAppConfigStore.getState();
		expect(s.terminalTheme).toBe("nord");
		expect(s.appTheme).toBe("pearl");
	});

	it("persists preferences across a fresh store instance", async () => {
		useAppConfigStore.setState({
			fontSize: 18,
			terminalTheme: "dracula",
			appTheme: "dusk",
		});

		vi.resetModules();
		({ useAppConfigStore } = await import("@/store/appConfig"));
		await useAppConfigStore.persist.rehydrate();

		const s = useAppConfigStore.getState();
		expect(s.fontSize).toBe(18);
		expect(s.terminalTheme).toBe("dracula");
		expect(s.appTheme).toBe("dusk");
	});
});

describe("useAppConfigStore persist version", () => {
	it("drops invalid JSON and keeps defaults", async () => {
		localStorage.setItem(APP_CONFIG_STORAGE_KEY, "not-json{");
		vi.resetModules();
		({ useAppConfigStore } = await import("@/store/appConfig"));
		await useAppConfigStore.persist.rehydrate();
		expect(localStorage.getItem(APP_CONFIG_STORAGE_KEY)).toBeNull();
		expect(useAppConfigStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE);
	});

	it("drops blob when version field is missing", async () => {
		localStorage.setItem(
			APP_CONFIG_STORAGE_KEY,
			JSON.stringify({
				state: {
					fontSize: 14,
					terminalTheme: "gruvbox",
					appTheme: "void",
				},
			}),
		);
		vi.resetModules();
		({ useAppConfigStore } = await import("@/store/appConfig"));
		await useAppConfigStore.persist.rehydrate();
		expect(localStorage.getItem(APP_CONFIG_STORAGE_KEY)).toBeNull();
		expect(useAppConfigStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE);
	});

	it("drops blob when version is stale", async () => {
		localStorage.setItem(
			APP_CONFIG_STORAGE_KEY,
			JSON.stringify({
				state: {
					fontSize: 14,
					terminalTheme: "gruvbox",
					appTheme: "void",
				},
				version: APP_CONFIG_PERSIST_VERSION - 1,
			}),
		);
		vi.resetModules();
		({ useAppConfigStore } = await import("@/store/appConfig"));
		await useAppConfigStore.persist.rehydrate();
		expect(localStorage.getItem(APP_CONFIG_STORAGE_KEY)).toBeNull();
		expect(useAppConfigStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE);
	});

	it("drops blob when version is newer than this app expects", async () => {
		localStorage.setItem(
			APP_CONFIG_STORAGE_KEY,
			JSON.stringify({
				state: {
					fontSize: 22,
					terminalTheme: "nord",
					appTheme: "pearl",
				},
				version: APP_CONFIG_PERSIST_VERSION + 1,
			}),
		);
		vi.resetModules();
		({ useAppConfigStore } = await import("@/store/appConfig"));
		await useAppConfigStore.persist.rehydrate();
		expect(localStorage.getItem(APP_CONFIG_STORAGE_KEY)).toBeNull();
		expect(useAppConfigStore.getState().fontSize).toBe(DEFAULT_FONT_SIZE);
		expect(useAppConfigStore.getState().terminalTheme).toBe("gruvbox");
	});
});
