import { useEffect, useRef, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { debounce } from "@/lib/debounce";

/**
 * Single debounced `fit()` + PTY `resize` so layout churn (sidebar, split) doesn’t
 * paint intermediate column/row sizes. Refs avoid stale `Terminal` in the closure.
 */
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
