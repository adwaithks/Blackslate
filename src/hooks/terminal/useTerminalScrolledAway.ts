import { useState, useEffect, useCallback } from "react";
import type { Terminal } from "@xterm/xterm";

// How many lines from the bottom before the scroll-to-bottom button appears.
const SCROLL_THRESHOLD = 5;

export function useTerminalScrolledAway(terminal: Terminal | null): {
	isScrolledAway: boolean;
	scrollToBottom: () => void;
} {
	const [isScrolledAway, setIsScrolledAway] = useState(false);

	useEffect(() => {
		if (!terminal) return;

		const check = () => {
			const buf = terminal.buffer.active;
			const distanceFromBottom = buf.length - terminal.rows - buf.viewportY;
			setIsScrolledAway(distanceFromBottom > SCROLL_THRESHOLD);
		};

		check();

		const d1 = terminal.onScroll(check);
		const d2 = terminal.onResize(check);
		return () => {
			d1.dispose();
			d2.dispose();
		};
	}, [terminal]);

	const scrollToBottom = useCallback(() => {
		terminal?.scrollToBottom();
	}, [terminal]);

	return { isScrolledAway, scrollToBottom };
}
