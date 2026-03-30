import { useEffect } from "react";

const CSS_VAR = "--chrome-sidebar-surface";

/**
 * Pushes the chosen sidebar tint from settings into a document CSS variable so
 * the titlebar strip next to the traffic-light area matches the shadcn sidebar.
 */
export function useChromeSidebarSurface(color: string): void {
	useEffect(() => {
		document.documentElement.style.setProperty(CSS_VAR, color);
	}, [color]);
}
