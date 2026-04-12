import { useCallback, useEffect, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { resolveTerminalTheme } from "@/components/terminal/terminalPaneTheme";
import { useDebouncedTerminalFitResize } from "./useDebouncedTerminalFitResize";

interface UseTerminalPaneLayoutSyncParams {
	terminal: Terminal | null;
	fontSize: number;
	terminalThemeId: string;
	terminalSurface: string;
	containerRef: RefObject<HTMLDivElement | null>;
	terminalRef: RefObject<Terminal | null>;
	isActive: boolean;
	fitAddonRef: RefObject<FitAddon | null>;
	sendResize: (cols: number, rows: number) => void;
}

// Keeps xterm matched to this pane: font and colors from settings, size from the div and from the shell (PTY),
// and refit + focus when the user switches back to this tab (hidden panes often measure as 0×0).
export function useTerminalPaneLayoutSync({
	terminal,
	fontSize,
	terminalThemeId,
	terminalSurface,
	containerRef,
	terminalRef,
	isActive,
	fitAddonRef,
	sendResize,
}: UseTerminalPaneLayoutSyncParams) {
	// Batches fit + PTY resize so dragging splitters does not spam resize for every pixel.
	const debouncedFitAndResizeRef = useDebouncedTerminalFitResize(
		sendResize,
		fitAddonRef,
		terminalRef,
	);

	// Immediate fit using the current Terminal instance (used when font changes or tab becomes active).
	const fitAndResize = useCallback(() => {
		fitAddonRef.current?.fit();
		if (terminal) sendResize(terminal.cols, terminal.rows);
	}, [terminal, sendResize]);

	useEffect(() => {
		if (!terminal) return;
		terminal.options.fontSize = fontSize;
		// Next frame so the DOM has applied the new font metrics before we measure columns/rows.
		requestAnimationFrame(fitAndResize);
	}, [fontSize, terminal, fitAndResize]);

	useEffect(() => {
		if (!terminal) return;
		terminal.options.theme = resolveTerminalTheme(terminalThemeId, terminalSurface);
	}, [terminalThemeId, terminalSurface, terminal]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !terminal) return;

		const observer = new ResizeObserver(() => {
			debouncedFitAndResizeRef.current?.();
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, [terminal, containerRef, debouncedFitAndResizeRef]);

	useEffect(() => {
		if (!isActive || !terminal) return;
		requestAnimationFrame(() => {
			fitAndResize();
			terminal.focus();
		});
	}, [isActive, terminal, fitAndResize]);
}
