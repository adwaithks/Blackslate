import { useEffect, type RefObject } from "react";

// When open, run onClose if the user clicks outside the given element.
export function useDismissOnOutsideClick(
	open: boolean,
	onClose: () => void,
	containerRef: RefObject<HTMLElement | null>,
) {
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open, onClose]);
}
