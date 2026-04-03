import { beforeEach, describe, expect, it } from "vitest";

import { useRenameUiStore } from "@/store/renameUiStore";

beforeEach(() => {
	useRenameUiStore.setState({ target: null });
});

describe("useRenameUiStore", () => {
	it("starts with no rename target", () => {
		expect(useRenameUiStore.getState().target).toBeNull();
	});

	it("openSession sets a session target", () => {
		useRenameUiStore.getState().openSession("sess-1");
		expect(useRenameUiStore.getState().target).toEqual({
			kind: "session",
			sessionId: "sess-1",
		});
	});

	it("openWorkspace sets a workspace target", () => {
		useRenameUiStore.getState().openWorkspace("ws-2");
		expect(useRenameUiStore.getState().target).toEqual({
			kind: "workspace",
			workspaceId: "ws-2",
		});
	});

	it("opening one target replaces the previous target", () => {
		useRenameUiStore.getState().openSession("a");
		useRenameUiStore.getState().openWorkspace("b");
		expect(useRenameUiStore.getState().target).toEqual({
			kind: "workspace",
			workspaceId: "b",
		});
	});

	it("close clears the target", () => {
		useRenameUiStore.getState().openSession("x");
		useRenameUiStore.getState().close();
		expect(useRenameUiStore.getState().target).toBeNull();
	});

	it("close leaves state null when already closed", () => {
		useRenameUiStore.getState().close();
		expect(useRenameUiStore.getState().target).toBeNull();
	});
});
