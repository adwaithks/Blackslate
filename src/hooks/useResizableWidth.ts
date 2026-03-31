import { useEffect, useRef, useState } from "react";

type DragEdge = "left" | "right";

function readStoredWidth(storageKey: string, fallback: number): number {
	try {
		const v = localStorage.getItem(storageKey);
		const n = v ? Number.parseInt(v, 10) : NaN;
		if (Number.isFinite(n)) return n;
	} catch {
		/* ignore */
	}
	return fallback;
}

/**
 * Shared width resize hook for panels/sidebars.
 * - Updates inline width live during drag
 * - Persists final width to localStorage on mouseup
 */
export function useResizableWidth({
	storageKey,
	defaultWidth,
	minWidth,
	maxWidth,
	dragEdge,
	reserveMainPx = 200,
}: {
	storageKey: string;
	defaultWidth: number;
	minWidth: number;
	maxWidth: number;
	/** Which edge the drag handle sits on */
	dragEdge: DragEdge;
	/** Prevent panels from consuming the entire window */
	reserveMainPx?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const dragState = useRef<{ startX: number; startWidth: number } | null>(
		null,
	);
	const [width, setWidth] = useState(() =>
		readStoredWidth(storageKey, defaultWidth),
	);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!dragState.current) return;
			const delta =
				dragEdge === "left"
					? dragState.current.startX - e.clientX
					: e.clientX - dragState.current.startX;

			const maxW = Math.min(
				maxWidth,
				Math.max(minWidth, window.innerWidth - reserveMainPx),
			);
			const w = Math.max(
				minWidth,
				Math.min(maxW, dragState.current.startWidth + delta),
			);
			const el = ref.current;
			if (el) el.style.width = `${w}px`;
		};

		const onUp = () => {
			if (!dragState.current) return;
			dragState.current = null;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			const el = ref.current;
			if (!el) return;
			const w = Math.round(el.getBoundingClientRect().width);
			setWidth(w);
			try {
				localStorage.setItem(storageKey, String(w));
			} catch {
				/* ignore */
			}
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
		return () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
	}, [defaultWidth, dragEdge, maxWidth, minWidth, reserveMainPx, storageKey]);

	function onResizeMouseDown(e: React.MouseEvent) {
		const el = ref.current;
		const startWidth = el
			? Math.round(el.getBoundingClientRect().width)
			: width;
		dragState.current = {
			startX: e.clientX,
			startWidth,
		};
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		e.preventDefault();
	}

	return { ref, width, onResizeMouseDown };
}

