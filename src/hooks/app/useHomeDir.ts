import { useEffect, useState } from "react";
import { getHomeDir } from "@/lib/getHomeDir";

// Looks up your home folder once so we can show full paths in the title bar and git panel.
export function useHomeDir(): string {
	const [homeDir, setHomeDir] = useState("");

	useEffect(() => {
		getHomeDir()
			.then(setHomeDir)
			.catch(() => setHomeDir(""));
	}, []);

	return homeDir;
}
