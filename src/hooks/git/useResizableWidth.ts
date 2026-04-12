// Drag a strip to change panel width. Put `ref` on the panel you resize.
// Starting width can be remembered between visits. While dragging we only change width on the element (fewer UI updates).
// On release we snap, save, and put the cursor back.

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
} from "react";

// Drag the left edge of a right-side panel, or the right edge of a left-side panel.
type DragEdge = "left" | "right";

export type UseResizableWidthOptions = {
	storageKey: string;
	defaultWidth: number;
	minWidth: number;
	maxWidth: number;
	dragEdge: DragEdge;
	// Keep at least this much room for the main area so the panel can't fill the whole window.
	reserveMainPx?: number;
};

type ActiveDrag = {
	// Mouse X when the drag started
	startPointerX: number;
	// Panel width when the drag started
	startWidthPx: number;
};

function loadStoredWidthPx(storageKey: string, fallbackPx: number): number {
	try {
		const raw = localStorage.getItem(storageKey);
		const n = raw ? Number.parseInt(raw, 10) : NaN;
		if (Number.isFinite(n)) return n;
	} catch {
		// private mode, quota, etc.
	}
	return fallbackPx;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

// Don't let the panel exceed max width or take the last bit of window width we reserve for the main view.
function effectiveMaxWidthPx(
	minWidth: number,
	maxWidth: number,
	reserveMainPx: number,
): number {
	const roomForPanel = window.innerWidth - reserveMainPx;
	return Math.min(maxWidth, Math.max(minWidth, roomForPanel));
}

// How far the mouse moved sideways; direction depends on which edge you drag.
function pointerDeltaForEdge(
	dragEdge: DragEdge,
	startPointerX: number,
	currentPointerX: number,
): number {
	return dragEdge === "left"
		? startPointerX - currentPointerX
		: currentPointerX - startPointerX;
}

export function useResizableWidth({
	storageKey,
	defaultWidth,
	minWidth,
	maxWidth,
	dragEdge,
	reserveMainPx = 200,
}: UseResizableWidthOptions) {
	const panelRef = useRef<HTMLDivElement>(null);
	const activeDragRef = useRef<ActiveDrag | null>(null);

	const [widthPx, setWidthPx] = useState(() =>
		loadStoredWidthPx(storageKey, defaultWidth),
	);

	useEffect(() => {
		const onPointerMove = (e: MouseEvent) => {
			const drag = activeDragRef.current;
			if (!drag) return;

			const delta = pointerDeltaForEdge(
				dragEdge,
				drag.startPointerX,
				e.clientX,
			);
			const cap = effectiveMaxWidthPx(minWidth, maxWidth, reserveMainPx);
			const nextWidth = clamp(
				drag.startWidthPx + delta,
				minWidth,
				cap,
			);

			const el = panelRef.current;
			if (el) el.style.width = `${nextWidth}px`;
		};

		const onPointerUp = () => {
			if (!activeDragRef.current) return;
			activeDragRef.current = null;

			document.body.style.cursor = "";
			document.body.style.userSelect = "";

			const el = panelRef.current;
			if (!el) return;

			const finalWidth = Math.round(el.getBoundingClientRect().width);
			setWidthPx(finalWidth);
			try {
				localStorage.setItem(storageKey, String(finalWidth));
			} catch {
				// ignore storage errors
			}
		};

		document.addEventListener("mousemove", onPointerMove);
		document.addEventListener("mouseup", onPointerUp);
		return () => {
			document.removeEventListener("mousemove", onPointerMove);
			document.removeEventListener("mouseup", onPointerUp);
		};
	}, [dragEdge, maxWidth, minWidth, reserveMainPx, storageKey]);

	const onResizeMouseDown = useCallback(
		(e: ReactMouseEvent) => {
			const el = panelRef.current;
			const startWidthPx = el
				? Math.round(el.getBoundingClientRect().width)
				: widthPx;

			activeDragRef.current = {
				startPointerX: e.clientX,
				startWidthPx,
			};
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			e.preventDefault();
		},
		[widthPx],
	);

	// `ref` — panel root. `width` — last committed width (after drag). `onResizeMouseDown` — drag handle.
	return { ref: panelRef, width: widthPx, onResizeMouseDown };
}
