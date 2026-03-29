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
					// Deduplicate against existing list
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
