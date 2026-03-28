import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { usePty } from "../../hooks/usePty";

/**
 * Mounts a single xterm.js terminal instance and connects it to a PTY
 * session in the Rust backend via the usePty hook.
 *
 * The component is intentionally dumb — it owns rendering (xterm.js) and
 * delegates all I/O to usePty. Layout decisions belong to the parent.
 *
 * Session identity is managed via React's `key` prop on the parent side,
 * which forces a full remount (new xterm + new PTY) when the session changes.
 */
export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm.js once on mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      // Transparent background so macOS vibrancy/window tinting can show through.
      theme: {
        background: "#00000000",
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
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      allowTransparency: true,
      // macOS-style smooth scrolling
      smoothScrollDuration: 80,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(container);

    // Attempt WebGL renderer — best performance (GPU-accelerated).
    // Falls back to canvas/DOM automatically if WebGL is unavailable.
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        // GPU context was lost (e.g. GPU reset). Dispose and let xterm fall
        // back to its software renderer.
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available — xterm will use its built-in canvas renderer.
    }

    fitAddon.fit();
    fitAddonRef.current = fitAddon;

    // Focus after the current paint so the webview is ready to accept it.
    requestAnimationFrame(() => term.focus());

    setTerminal(term);

    return () => {
      term.dispose();
      setTerminal(null);
      fitAddonRef.current = null;
    };
  }, []);

  // Connect the terminal to the PTY backend.
  const { sendResize } = usePty({ terminal });

  // Resize the PTY whenever the container changes size.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !terminal) return;

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      sendResize(terminal.cols, terminal.rows);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [terminal, sendResize]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      // Clicking anywhere on the pane restores keyboard focus to xterm.
      onClick={() => terminal?.focus()}
    />
  );
}
