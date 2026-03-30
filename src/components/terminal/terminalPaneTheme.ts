import * as terminalThemes from "@/lib/terminalThemes";
import { TERMINAL_SURFACE } from "@/components/terminal/terminalPaneConstants";

/** Maps settings id → full `ITheme` (background forced to `TERMINAL_SURFACE`). */
export function resolveTerminalTheme(themeId: string) {
	return (
		terminalThemes[themeId as keyof typeof terminalThemes]?.(
			TERMINAL_SURFACE,
		) ?? terminalThemes.gruvboxDark(TERMINAL_SURFACE)
	);
}
