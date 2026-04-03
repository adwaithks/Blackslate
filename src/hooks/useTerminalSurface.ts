import { useMemo } from "react";
import { useAppConfigStore, appThemeValue } from "@/store/appConfig";
import { deriveThemeVars } from "@/lib/colorUtils";

/**
 * Returns the terminal surface hex — the deepest level in the elevation
 * ladder. Delegates to `deriveThemeVars` so the offset is defined in one place.
 */
export function useTerminalSurface(): string {
	const appThemeId = useAppConfigStore((s) => s.appTheme);
	const raw = appThemeValue(appThemeId);
	return useMemo(() => deriveThemeVars(raw)["--terminal"], [raw]);
}
