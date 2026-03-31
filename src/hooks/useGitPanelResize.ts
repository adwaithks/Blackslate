import {
	GIT_PANEL_MAX_W,
	GIT_PANEL_MIN_W,
	GIT_PANEL_WIDTH_KEY,
	readStoredGitPanelWidth,
} from "@/components/git/gitPanelHelpers";
import { useResizableWidth } from "@/hooks/useResizableWidth";

/**
 * Left-edge drag handle for the git panel: updates inline width during drag,
 * persists width to localStorage on mouseup.
 */
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
