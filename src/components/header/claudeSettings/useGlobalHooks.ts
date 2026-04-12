import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toastError } from "@/lib/toastError";
import type { HookInfo } from "./types";

// Load machine-wide automation hooks once when this tab mounts.
export function useGlobalHooks() {
	const [hooks, setHooks] = useState<HookInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		invoke<HookInfo[]>("list_global_hooks")
			.then(setHooks)
			.catch((e) => {
				setHooks([]);
				toastError("Could not load global hooks", e);
			})
			.finally(() => setLoading(false));
	}, []);

	return { hooks, loading };
}
