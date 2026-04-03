import { useAppConfigStore, appThemeValue } from "@/store/appConfig";
import { isLightSurface } from "@/lib/colorUtils";

/** True when the active app theme base colour resolves to a light surface. */
export function useIsLightTheme(): boolean {
	const id = useAppConfigStore((s) => s.appTheme);
	return isLightSurface(appThemeValue(id));
}
