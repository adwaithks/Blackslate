// Folders the user added to the git panel. Paths are saved in the browser under the name git-repos.
// Helpers elsewhere normalize paths when comparing.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GitReposState {
	// Full paths on disk.
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
