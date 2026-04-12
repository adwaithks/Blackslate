import { useAppShortcuts } from "@/lib/appShortcuts";
import {
	buildAppLayoutShortcuts,
	type AppLayoutShortcutDeps,
} from "@/lib/appLayoutShortcuts";

// Hotkeys for workspaces, tabs, git panel, sidebar, zoom. Refreshes handlers each press so state stays current.
export function useAppLayoutShortcuts(deps: AppLayoutShortcutDeps): void {
	useAppShortcuts(() => buildAppLayoutShortcuts(deps));
}
