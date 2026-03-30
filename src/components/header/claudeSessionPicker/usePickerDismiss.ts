import { useEffect, type RefObject } from "react";

/**
 * While `open`, closes the picker on outside mousedown or Escape.
 * `containerRef` is the root that should *not* count as “outside”.
 */
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
