import { useEffect, useState } from "react";
import { getHomeDir } from "@/hooks/usePty";

/**
 * Resolves the user's home directory once (for turning "~" cwd into an absolute
 * path in the titlebar and for GitPanel).
 */
export function useHomeDir(): string {
	const [homeDir, setHomeDir] = useState("");

	useEffect(() => {
		getHomeDir()
			.then(setHomeDir)
			.catch(() => setHomeDir(""));
	}, []);

	return homeDir;
}
