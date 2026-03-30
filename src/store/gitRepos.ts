/**
 * Git panel: list of repo roots the user chose to track.
 *
 * Persisted under localStorage key `git-repos` (see `persist.name` below).
 * Paths are not normalised here — callers that need equality use `normalizeRepoPath`
 * in `gitPanelHelpers`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GitReposState {
	/** Absolute paths of all tracked repos (persisted across restarts). */
	repos: string[];
	addRepos: (paths: string[]) => void;
	removeRepo: (path: string) => void;
}

export const useGitReposStore = create<GitReposState>()(
	persist(
		(set) => ({
			repos: [],

			addRepos: (paths) =>
				set((state) => ({
					repos: [...new Set([...state.repos, ...paths])],
				})),

			removeRepo: (path) =>
				set((state) => ({
					repos: state.repos.filter((r) => r !== path),
				})),
		}),
		{ name: "git-repos" },
	),
);
