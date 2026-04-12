import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { getThemeFont } from "@/lib/systemFonts";
import { resolveTerminalTheme } from "@/components/terminal/terminalPaneTheme";
import { attachTerminalUrlLinking } from "@/components/terminal/terminalUrlLink";

// Builds the terminal widget when this tab appears; tears it down when the tab goes away.
// First paint picks font and colors; later tweaks are handled in useTerminalPaneLayoutSync.
export function useTerminalBootstrap(fontSize: number, themeId: string, surface: string) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [terminal, setTerminal] = useState<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	// Debounced resize reads this so the callback never closes over a stale Terminal.
	const terminalRef = useRef<Terminal | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const term = new Terminal({
			theme: resolveTerminalTheme(themeId, surface),
			fontFamily: getThemeFont("--font-mono"),
			fontSize,
			lineHeight: 1.1,
			cursorBlink: true,
			cursorStyle: "bar",
			scrollback: 10_000,
			smoothScrollDuration: 80,
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(container);

		// Prefer GPU drawing; if that fails, the terminal still works with the normal renderer.
		try {
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => webgl.dispose());
			term.loadAddon(webgl);
		} catch {
			// normal canvas renderer
		}

		attachTerminalUrlLinking(term);

		fitAddon.fit();
		fitAddonRef.current = fitAddon;

		requestAnimationFrame(() => term.focus());

		terminalRef.current = term;
		setTerminal(term);
		return () => {
			term.dispose();
			terminalRef.current = null;
			setTerminal(null);
			fitAddonRef.current = null;
		};
		// Intentionally empty: initial dimensions/theme match first paint only.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per pane
	}, []);

	return { containerRef, terminal, terminalRef, fitAddonRef };
}
