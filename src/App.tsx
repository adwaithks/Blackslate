import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { AppLayout } from "@/components/layout/AppLayout";
import { parseWorkspaceLayoutToSessionState } from "@/lib/workspaceLayoutSnapshot";
import { useSessionStore } from "@/store/sessionsStore";

export default function App() {
	const [layoutReady, setLayoutReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const raw = await invoke<string | null>("workspace_snapshot_read");
				if (cancelled) return;
				if (raw) {
					const state = parseWorkspaceLayoutToSessionState(raw);
					if (state) {
						useSessionStore.setState({
							workspaces: state.workspaces,
							activeWorkspaceId: state.activeWorkspaceId,
						});
					}
				}
			} catch (e) {
				console.error("[workspace layout] hydrate failed", e);
			} finally {
				if (!cancelled) setLayoutReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (!layoutReady) {
		return null;
	}

	return <AppLayout />;
}
