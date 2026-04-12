import { invoke } from "@tauri-apps/api/core";

// Ask the desktop backend once; reuse the same in-flight promise if several callers ask at once.
let homeDirPromise: Promise<string> | null = null;

export function getHomeDir(): Promise<string> {
	if (!homeDirPromise) homeDirPromise = invoke<string>("get_home_dir");
	return homeDirPromise;
}
