import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

// Same regex WebLinksAddon uses — handles trailing punctuation correctly.
const URL_REGEX_SRC =
	/(https?|ftp):\/\/[^\s"'<>[\]{}|\\^`]*[^\s"':,.!?{}|\\^~[\]`()<>]/.source;
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePty } from "@/hooks/usePty";
import {
	useSessionStore,
	type GitInfo,
	type ProjectStackItem,
} from "@/store/sessions";
import { useSettingsStore } from "@/store/settings";
import { getThemeFont } from "@/lib/systemFonts";
import * as terminalThemes from "@/lib/terminalThemes";

/** xterm scrollback / cell layer — not just the outer DOM wrapper */
const TERMINAL_SURFACE = "#000000";

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
	const terminalThemeId = useSettingsStore((s) => s.terminalTheme);

	const resolveTheme = () =>
		terminalThemes[terminalThemeId]?.(TERMINAL_SURFACE) ??
		terminalThemes.gruvboxDark(TERMINAL_SURFACE);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const term = new Terminal({
			theme: resolveTheme(),
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

		// WebGL renderer — GPU accelerated (same as VS Code). Falls back to
		// canvas/DOM automatically on context loss or if WebGL is unavailable.
		try {
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => webgl.dispose());
			term.loadAddon(webgl);
		} catch {
			// WebGL unavailable — xterm uses its canvas renderer.
		}

		// ── URL links ─────────────────────────────────────────────────────────
		// Clickable link provider: hover shows underline + pointer cursor; click
		// opens in the default browser via Tauri's opener plugin.
		term.registerLinkProvider({
			provideLinks(lineNumber, callback) {
				const line = term.buffer.active.getLine(lineNumber - 1);
				if (!line) {
					callback(undefined);
					return;
				}
				const text = line.translateToString(true);
				const re = new RegExp(URL_REGEX_SRC, "g");
				const links: Parameters<typeof callback>[0] = [];
				let m: RegExpExecArray | null;
				while ((m = re.exec(text)) !== null) {
					const url = m[0];
					const x = m.index;
					links!.push({
						range: {
							start: { x: x + 1, y: lineNumber },
							end: { x: x + url.length, y: lineNumber },
						},
						text: url,
						decorations: { pointerCursor: true, underline: true },
						activate(_e, uri) {
							openUrl(uri).catch(console.error);
						},
					});
				}
				callback(links!.length ? links : undefined);
			},
		});

		// Permanent blue underline for URLs using buffer decorations.
		// onWriteParsed fires after each PTY write is parsed — we scan recently
		// written lines and add a border-bottom DOM element over each URL.
		// foregroundColor colours the text via the WebGL renderer.
		const decoratedLines = new Set<number>();
		term.onWriteParsed(() => {
			const active = term.buffer.active;
			const cursorAbsY = active.baseY + active.cursorY;
			for (
				let absY = Math.max(0, cursorAbsY - 3);
				absY <= cursorAbsY;
				absY++
			) {
				if (decoratedLines.has(absY)) continue;
				const line = active.getLine(absY);
				if (!line) continue;
				const text = line.translateToString(true);
				const re = new RegExp(URL_REGEX_SRC, "g");
				let m: RegExpExecArray | null;
				let marker: ReturnType<typeof term.registerMarker> | undefined;
				decoratedLines.add(absY);
				while ((m = re.exec(text)) !== null) {
					if (!marker) {
						marker =
							term.registerMarker(absY - cursorAbsY) ?? undefined;
						if (!marker) break;
						marker.onDispose(() => decoratedLines.delete(absY));
					}
					term.registerDecoration({
						marker,
						x: m.index,
						width: m[0].length,
						foregroundColor: "#569cd6",
						layer: "top",
					})?.onRender((el) => {
						el.style.boxSizing = "border-box";
						el.style.borderBottom =
							"1px solid rgba(86,156,214,0.7)";
						el.style.pointerEvents = "none";
					});
				}
			}
		});

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

	// ── Terminal theme — live update when the user switches in Settings ────
	useEffect(() => {
		if (!terminal) return;
		terminal.options.theme = resolveTheme();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [terminalThemeId, terminal]);

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
			className="w-full h-full bg-black pl-2 pb-2 pt-2"
			onClick={() => terminal?.focus()}
		>
			<div ref={containerRef} className="w-full h-full" />
		</div>
	);
}
