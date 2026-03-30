import { useEffect, useRef, useState } from "react";
import {
	GIT_PANEL_MAX_W,
	GIT_PANEL_MIN_W,
	GIT_PANEL_WIDTH_KEY,
	readStoredGitPanelWidth,
} from "@/components/git/gitPanelHelpers";

/**
 * Left-edge drag handle for the git panel: updates inline width during drag,
 * persists width to localStorage on mouseup.
 */
export function useGitPanelResize() {
	const panelRef = useRef<HTMLDivElement>(null);
	const dragState = useRef<{ startX: number; startWidth: number } | null>(
		null,
	);
	const [panelWidth, setPanelWidth] = useState(readStoredGitPanelWidth);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragState.current) return;
			const delta = dragState.current.startX - e.clientX;
			const reserveMain = 200;
			const maxW = Math.min(
				GIT_PANEL_MAX_W,
				Math.max(GIT_PANEL_MIN_W, window.innerWidth - reserveMain),
			);
			const w = Math.max(
				GIT_PANEL_MIN_W,
				Math.min(maxW, dragState.current.startWidth + delta),
			);
			const el = panelRef.current;
			if (el) el.style.width = `${w}px`;
		};
		const onUp = () => {
			if (!dragState.current) return;
			dragState.current = null;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			const el = panelRef.current;
			if (el) {
				const w = Math.round(el.getBoundingClientRect().width);
				setPanelWidth(w);
				try {
					localStorage.setItem(GIT_PANEL_WIDTH_KEY, String(w));
				} catch {
					/* ignore */
				}
			}
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
	}, []);

	function onResizeMouseDown(e: React.MouseEvent) {
		const el = panelRef.current;
		const startWidth = el
			? Math.round(el.getBoundingClientRect().width)
			: panelWidth;
		dragState.current = {
			startX: e.clientX,
			startWidth,
		};
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		e.preventDefault();
	}

	return { panelRef, panelWidth, onResizeMouseDown };
}
