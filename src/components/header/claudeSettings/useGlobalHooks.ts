import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HookInfo } from "./types";

/** `list_global_hooks` on mount (hooks → global). */
export function useGlobalHooks() {
	const [hooks, setHooks] = useState<HookInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		invoke<HookInfo[]>("list_global_hooks")
			.then(setHooks)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	return { hooks, loading };
}
