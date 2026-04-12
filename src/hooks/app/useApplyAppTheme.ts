import { useLayoutEffect } from "react";
import { deriveThemeVars } from "@/lib/colorUtils";

// Paints the chosen light/dark base color and related colors on the page root before you see a flash.
export function useApplyAppTheme(resolvedBaseHex: string): void {
	useLayoutEffect(() => {
		const root = document.documentElement.style;
		root.setProperty("--chrome-sidebar-surface", resolvedBaseHex);

		const vars = deriveThemeVars(resolvedBaseHex);
		for (const [prop, value] of Object.entries(vars)) {
			root.setProperty(prop, value);
		}
	}, [resolvedBaseHex]);
}
