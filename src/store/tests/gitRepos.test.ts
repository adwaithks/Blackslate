import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubZustandPersistEnv } from "@/test/stubZustandPersistEnv";

type GitReposModule = typeof import("@/store/gitRepos");

let useGitReposStore: GitReposModule["useGitReposStore"];

beforeEach(async () => {
	stubZustandPersistEnv();
	vi.resetModules();
	({ useGitReposStore } = await import("@/store/gitRepos"));
	await useGitReposStore.persist.rehydrate();
});

describe("useGitReposStore", () => {
	it("starts with an empty repo list", () => {
		expect(useGitReposStore.getState().repos).toEqual([]);
	});

	it("addRepos appends paths", () => {
		useGitReposStore.getState().addRepos(["/a", "/b"]);
		expect(useGitReposStore.getState().repos).toEqual(["/a", "/b"]);
	});

	it("addRepos dedupes within the same batch", () => {
		useGitReposStore.getState().addRepos(["/x", "/x", "/y"]);
		expect(useGitReposStore.getState().repos).toEqual(["/x", "/y"]);
	});

	it("addRepos dedupes against existing repos", () => {
		useGitReposStore.getState().addRepos(["/a", "/b"]);
		useGitReposStore.getState().addRepos(["/b", "/c"]);
		expect(useGitReposStore.getState().repos).toEqual(["/a", "/b", "/c"]);
	});

	it("removeRepo drops an exact path match", () => {
		useGitReposStore.getState().addRepos(["/keep", "/drop"]);
		useGitReposStore.getState().removeRepo("/drop");
		expect(useGitReposStore.getState().repos).toEqual(["/keep"]);
	});

	it("removeRepo is a no-op when the path is not tracked", () => {
		useGitReposStore.getState().addRepos(["/only"]);
		useGitReposStore.getState().removeRepo("/missing");
		expect(useGitReposStore.getState().repos).toEqual(["/only"]);
	});

	it("persists repos across a fresh store instance", async () => {
		useGitReposStore.getState().addRepos(["/project/foo", "/project/bar"]);

		vi.resetModules();
		({ useGitReposStore } = await import("@/store/gitRepos"));
		await useGitReposStore.persist.rehydrate();

		expect(useGitReposStore.getState().repos).toEqual([
			"/project/foo",
			"/project/bar",
		]);
	});
});
