import { useLayoutEffect } from "react";
import { deriveThemeVars } from "@/lib/colorUtils";

/**
 * Applies the selected app theme: sets `--chrome-sidebar-surface` and derived
 * CSS variables from {@link deriveThemeVars} before paint.
 */
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
