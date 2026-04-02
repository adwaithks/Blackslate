import { useLayoutEffect } from "react";
import { deriveThemeVars } from "@/lib/colorUtils";

/**
 * Derives the entire app theme from the chosen sidebar color and pushes it
 * into document CSS variables before paint, so CSS-var surfaces update in the
 * same frame as inline terminal backgrounds.
 */
export function useChromeSidebarSurface(color: string): void {
	useLayoutEffect(() => {
		const root = document.documentElement.style;
		root.setProperty("--chrome-sidebar-surface", color);

		const vars = deriveThemeVars(color);
		for (const [prop, value] of Object.entries(vars)) {
			root.setProperty(prop, value);
		}
	}, [color]);
}
