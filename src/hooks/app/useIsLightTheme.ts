import { useAppConfigStore, appThemeValue } from "@/store/appConfig";
import { isLightSurface } from "@/lib/colorUtils";

// Whether the current theme is a light background (used for diff viewer and similar).
export function useIsLightTheme(): boolean {
	const id = useAppConfigStore((s) => s.appTheme);
	return isLightSurface(appThemeValue(id));
}
