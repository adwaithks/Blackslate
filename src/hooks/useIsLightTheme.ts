import { useSettingsStore, sidebarColorValue } from "@/store/settings";
import { isLightSurface } from "@/lib/colorUtils";

/** True when the active sidebar color resolves to a light surface. */
export function useIsLightTheme(): boolean {
	const id = useSettingsStore((s) => s.sidebarColor);
	return isLightSurface(sidebarColorValue(id));
}
