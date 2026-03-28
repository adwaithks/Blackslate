import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { usePty } from "@/hooks/usePty";
import {
	useSessionStore,
	type GitInfo,
	type ProjectStackItem,
} from "@/store/sessions";
import { useSettingsStore } from "@/store/settings";
import { getThemeFont } from "@/lib/systemFonts";

interface TerminalPaneProps {
	sessionId: string;
	/**
	 * When true, this pane is the visible session.
	 * Triggers a fit + focus so the terminal is ready to use immediately
	 * after switching from another session.
	 */
	isActive: boolean;
}

/**
 * A single xterm.js terminal instance connected to a PTY session.
 *
 * Intentionally thin — owns rendering (xterm.js) and delegates all I/O to
 * `usePty`. The parent (TerminalView) controls visibility and session identity.
 *
 * ## Lifecycle with multiple sessions
 * All TerminalPane instances remain mounted when switching sessions. The parent
 * hides inactive panes with `visibility: hidden` so xterm can still measure
 * dimensions. When a pane becomes active, `isActive` flips to true and we
 * re-fit and focus.
 */
export function TerminalPane({ sessionId, isActive }: TerminalPaneProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [terminal, setTerminal] = useState<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const fontSize = useSettingsStore((s) => s.fontSize);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const term = new Terminal({
			theme: {
				background: "#00000000", // transparent — lets macOS vibrancy show through
				foreground: "#d4d4d4",
				cursor: "#d4d4d4",
				selectionBackground: "#ffffff40",
				black: "#1e1e1e",
				red: "#f44747",
				green: "#4ec9b0",
				yellow: "#dcdcaa",
				blue: "#569cd6",
				magenta: "#c586c0",
				cyan: "#9cdcfe",
				white: "#d4d4d4",
				brightBlack: "#808080",
				brightRed: "#f44747",
				brightGreen: "#4ec9b0",
				brightYellow: "#dcdcaa",
				brightBlue: "#569cd6",
				brightMagenta: "#c586c0",
				brightCyan: "#9cdcfe",
				brightWhite: "#ffffff",
			},
			fontFamily: getThemeFont("--font-mono"),
			fontSize,
			lineHeight: 1,
			cursorBlink: true,
			cursorStyle: "bar",
			scrollback: 10_000,
			allowTransparency: true,
			smoothScrollDuration: 80,
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.loadAddon(new WebLinksAddon());
		term.open(container);

		// WebGL renderer — GPU accelerated (same as VS Code). Falls back to
		// canvas/DOM automatically on context loss or if WebGL is unavailable.
		try {
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => webgl.dispose());
			term.loadAddon(webgl);
		} catch {
			// WebGL unavailable — xterm uses its canvas renderer.
		}

		fitAddon.fit();
		fitAddonRef.current = fitAddon;

		// Defer focus so the webview is ready to accept keyboard events.
		requestAnimationFrame(() => term.focus());

		setTerminal(term);
		return () => {
			term.dispose();
			setTerminal(null);
			fitAddonRef.current = null;
		};
	}, []);

	const { sendResize } = usePty({ terminal, sessionId });

	// ── Git info + project stack — refresh whenever cwd changes ───────────
	const cwd = useSessionStore(
		(s) => s.sessions.find((x) => x.id === sessionId)?.cwd ?? "~",
	);
	const setGit = useSessionStore((s) => s.setGit);
	const setProjectStack = useSessionStore((s) => s.setProjectStack);

	useEffect(() => {
		invoke<GitInfo | null>("git_info", { cwd })
			.then((git) => setGit(sessionId, git))
			.catch(() => setGit(sessionId, null));
	}, [cwd, sessionId, setGit]);

	useEffect(() => {
		invoke<ProjectStackItem[]>("project_stack", { cwd })
			.then((stack) => setProjectStack(sessionId, stack))
			.catch(() => setProjectStack(sessionId, []));
	}, [cwd, sessionId, setProjectStack]);

	// ── Shared fit helper — used by font, resize, and activation effects ──
	const fitAndResize = useCallback(() => {
		fitAddonRef.current?.fit();
		if (terminal) sendResize(terminal.cols, terminal.rows);
	}, [terminal, sendResize]);

	// ── Font size — update terminal and refit when the user zooms ─────────
	useEffect(() => {
		if (!terminal) return;
		terminal.options.fontSize = fontSize;
		requestAnimationFrame(fitAndResize);
	}, [fontSize, terminal, fitAndResize]);

	// ── Resize observer ────────────────────────────────────────────────────
	// fit() runs immediately to keep the terminal crisp; pty_resize is
	// debounced to avoid flooding the IPC channel during continuous drag.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !terminal) return;
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		const observer = new ResizeObserver(() => {
			fitAddonRef.current?.fit();
			if (debounceTimer !== null) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(
				() => sendResize(terminal.cols, terminal.rows),
				80,
			);
		});

		observer.observe(container);
		return () => {
			observer.disconnect();
			if (debounceTimer !== null) clearTimeout(debounceTimer);
		};
	}, [terminal, sendResize]);

	// ── Activation ─────────────────────────────────────────────────────────
	// Re-fit in case the container size changed while hidden, then focus.
	useEffect(() => {
		if (!isActive || !terminal) return;
		requestAnimationFrame(() => {
			fitAndResize();
			terminal.focus();
		});
	}, [isActive, terminal, fitAndResize]);

	return (
		<div
			className="w-full h-full pl-3 pt-2 pb-2 bg-black"
			onClick={() => terminal?.focus()}
		>
			<div ref={containerRef} className="w-full h-full" />
		</div>
	);
}
