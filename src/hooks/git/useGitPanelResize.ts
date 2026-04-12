import {
	GIT_PANEL_MAX_W,
	GIT_PANEL_MIN_W,
	GIT_PANEL_WIDTH_KEY,
	readStoredGitPanelWidth,
} from "@/components/git/gitPanelHelpers";
import { useResizableWidth } from "./useResizableWidth";

// Drag the git panel's left edge to resize; remembers width after you release the mouse.
export function useGitPanelResize() {
	const { ref, width, onResizeMouseDown } = useResizableWidth({
		storageKey: GIT_PANEL_WIDTH_KEY,
		defaultWidth: readStoredGitPanelWidth(),
		minWidth: GIT_PANEL_MIN_W,
		maxWidth: GIT_PANEL_MAX_W,
		dragEdge: "left",
	});

	return { panelRef: ref, panelWidth: width, onResizeMouseDown };
}
