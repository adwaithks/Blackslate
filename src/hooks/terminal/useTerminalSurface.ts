import { useMemo } from "react";
import { useAppConfigStore, appThemeValue } from "@/store/appConfig";
import { deriveThemeVars } from "@/lib/colorUtils";

// Background color for the terminal strip (from the current light/dark theme).
export function useTerminalSurface(): string {
	const appThemeId = useAppConfigStore((s) => s.appTheme);
	const raw = appThemeValue(appThemeId);
	return useMemo(() => deriveThemeVars(raw)["--terminal"], [raw]);
}
