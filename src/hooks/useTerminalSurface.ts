import { useMemo } from "react";
import { useSettingsStore, sidebarColorValue } from "@/store/settings";
import { deriveThemeVars } from "@/lib/colorUtils";

/**
 * Returns the terminal surface hex — the deepest level in the elevation
 * ladder. Delegates to `deriveThemeVars` so the offset is defined in one place.
 */
export function useTerminalSurface(): string {
	const sidebarColorId = useSettingsStore((s) => s.sidebarColor);
	const raw = sidebarColorValue(sidebarColorId);
	return useMemo(() => deriveThemeVars(raw)["--terminal"], [raw]);
}
