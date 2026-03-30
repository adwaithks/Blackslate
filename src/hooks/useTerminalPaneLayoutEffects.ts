import { useCallback, useEffect, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { resolveTerminalTheme } from "@/components/terminal/terminalPaneTheme";

type DebouncedFitResize = (() => void) & { cancel: () => void };

interface UseTerminalPaneLayoutEffectsParams {
	terminal: Terminal | null;
	fontSize: number;
	terminalThemeId: string;
	containerRef: RefObject<HTMLDivElement | null>;
	debouncedFitAndResizeRef: RefObject<DebouncedFitResize>;
	isActive: boolean;
	fitAddonRef: RefObject<FitAddon | null>;
	sendResize: (cols: number, rows: number) => void;
}

/**
 * Everything that reacts after the xterm exists: font zoom, palette swap,
 * container resize → debounced fit/PTY resize, and tab activation refit + focus.
 */
export function useTerminalPaneLayoutEffects({
	terminal,
	fontSize,
	terminalThemeId,
	containerRef,
	debouncedFitAndResizeRef,
	isActive,
	fitAddonRef,
	sendResize,
}: UseTerminalPaneLayoutEffectsParams) {
	const fitAndResize = useCallback(() => {
		fitAddonRef.current?.fit();
		if (terminal) sendResize(terminal.cols, terminal.rows);
	}, [terminal, sendResize]);

	useEffect(() => {
		if (!terminal) return;
		terminal.options.fontSize = fontSize;
		requestAnimationFrame(fitAndResize);
	}, [fontSize, terminal, fitAndResize]);

	useEffect(() => {
		if (!terminal) return;
		terminal.options.theme = resolveTerminalTheme(terminalThemeId);
	}, [terminalThemeId, terminal]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !terminal) return;

		const observer = new ResizeObserver(() => {
			debouncedFitAndResizeRef.current?.();
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, [terminal, containerRef, debouncedFitAndResizeRef]);

	// Hidden panes keep size 0×0 until shown — refit when this tab becomes visible.
	useEffect(() => {
		if (!isActive || !terminal) return;
		requestAnimationFrame(() => {
			fitAndResize();
			terminal.focus();
		});
	}, [isActive, terminal, fitAndResize]);
}
