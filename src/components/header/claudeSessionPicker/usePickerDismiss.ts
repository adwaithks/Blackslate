import { useEffect, type RefObject } from "react";

// When the picker is open, close it on click-away or Escape. Clicks inside containerRef don't count as away.
export function usePickerDismiss(
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
		// containerRef is stable; onClose is expected stable (e.g. useCallback from parent).
	}, [open, onClose]);

	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open, onClose]);
}
