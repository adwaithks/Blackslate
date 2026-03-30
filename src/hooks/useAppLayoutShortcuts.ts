import { useAppShortcuts } from "@/lib/appShortcuts";
import {
	buildAppLayoutShortcuts,
	type AppLayoutShortcutDeps,
} from "@/lib/appLayoutShortcuts";

/**
 * Registers window-level shortcuts for workspace/session/git/sidebar/zoom.
 * Passes a factory into useAppShortcuts so each keypress sees fresh setters.
 */
export function useAppLayoutShortcuts(deps: AppLayoutShortcutDeps): void {
	useAppShortcuts(() => buildAppLayoutShortcuts(deps));
}
