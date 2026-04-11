import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_FONT_SIZE,
	FONT_SIZE_STEP,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
} from "@/store/appConfig";

const PERSIST_KEY = "blackslate-settings";

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

async function rehydrateFromPersisted(
	state: Record<string, unknown>,
	version: number,
): Promise<AppConfigModule["useAppConfigStore"]> {
	localStorage.clear();
	localStorage.setItem(PERSIST_KEY, JSON.stringify({ state, version }));
	vi.resetModules();
	const m = await import("@/store/appConfig");
	await m.useAppConfigStore.persist.rehydrate();
	return m.useAppConfigStore;
}

describe("useAppConfigStore persist migration", () => {
	it("v1: maps sidebarColor to appTheme", async () => {
		const store = await rehydrateFromPersisted(
			{
				fontSize: 13,
				terminalTheme: "gruvbox",
				sidebarColor: "aurora",
			},
			1,
		);
		expect(store.getState().appTheme).toBe("aurora");
	});

	it("v1: maps legacy terminal theme strings", async () => {
		const store = await rehydrateFromPersisted(
			{
				fontSize: 13,
				terminalTheme: "oneDark",
				sidebarColor: "void",
			},
			1,
		);
		expect(store.getState().terminalTheme).toBe("one");
		expect(store.getState().appTheme).toBe("void");
	});

	it("v1: applies both sidebarColor and terminal migrations together", async () => {
		const store = await rehydrateFromPersisted(
			{
				fontSize: 20,
				terminalTheme: "solarizedDark",
				sidebarColor: "bone",
			},
			1,
		);
		const s = store.getState();
		expect(s.fontSize).toBe(20);
		expect(s.terminalTheme).toBe("solarized");
		expect(s.appTheme).toBe("bone");
	});

	it("v2: loads state without running v1 sidebar migration", async () => {
		const store = await rehydrateFromPersisted(
			{
				fontSize: 11,
				terminalTheme: "tokyoNight",
				appTheme: "ember",
			},
			2,
		);
		const s = store.getState();
		expect(s.fontSize).toBe(11);
		expect(s.terminalTheme).toBe("tokyoNight");
		expect(s.appTheme).toBe("ember");
	});

	it("v1: leaves appTheme as default merge when sidebarColor was absent", async () => {
		const store = await rehydrateFromPersisted(
			{
				fontSize: 9,
				terminalTheme: "gruvbox",
			},
			1,
		);
		expect(store.getState().fontSize).toBe(9);
		expect(store.getState().appTheme).toBe("void");
	});
});
