import { useEffect, useRef, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { debounce } from "@/lib/debounce";

// Waits a moment after layout moves, then resizes the terminal and tells the shell the new size (avoids flickery in-between sizes). Uses refs so the delayed call sees the latest terminal.
export function useDebouncedTerminalFitResize(
	sendResize: (cols: number, rows: number) => void,
	fitAddonRef: RefObject<FitAddon | null>,
	terminalRef: RefObject<Terminal | null>,
) {
	const debouncedFitAndResizeRef = useRef(
		debounce(() => {
			fitAddonRef.current?.fit();
			const t = terminalRef.current;
			if (t) sendResize(t.cols, t.rows);
		}, 80),
	);

	useEffect(() => {
		const fn = debouncedFitAndResizeRef.current;
		return () => fn.cancel();
	}, []);

	return debouncedFitAndResizeRef;
}
