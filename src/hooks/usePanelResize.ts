import { useCallback, useRef, useState } from "react";

interface UsePanelResizeOptions {
	initialWidth: number;
	min: number;
	max: number;
	/** 1 = drag-right grows the panel (default), -1 = drag-right shrinks the panel */
	direction?: 1 | -1;
	onEnd?: (width: number) => void;
}

export function usePanelResize({
	initialWidth,
	min,
	max,
	direction = 1,
	onEnd,
}: UsePanelResizeOptions) {
	const [width, setWidth] = useState(initialWidth);
	const onEndRef = useRef(onEnd);
	onEndRef.current = onEnd;

	const startDrag = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = width;

			document.body.classList.add("dragging-panel");
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const clamp = (w: number) => Math.min(max, Math.max(min, w));

			const onMove = (ev: MouseEvent) => {
				const delta = (ev.clientX - startX) * direction;
				setWidth(clamp(startWidth + delta));
			};

			const onUp = (ev: MouseEvent) => {
				document.body.classList.remove("dragging-panel");
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
				const finalWidth = clamp(startWidth + (ev.clientX - startX) * direction);
				onEndRef.current?.(finalWidth);
			};

			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[width, min, max, direction],
	);

	return { width, startDrag };
}
