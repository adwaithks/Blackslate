import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IDisposable } from "@xterm/xterm";

interface UsePtyOptions {
  terminal: Terminal | null;
}

export function usePty({ terminal }: UsePtyOptions) {
  const resizeFnRef = useRef<(cols: number, rows: number) => void>(() => {});

  const sendResize = useCallback((cols: number, rows: number) => {
    resizeFnRef.current(cols, rows);
  }, []);

  useEffect(() => {
    if (!terminal) return;
    const term = terminal;

    // Fresh UUID per effect invocation — no cross-mount conflicts in StrictMode.
    const ptyId = crypto.randomUUID();
    let active = true;
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let onDataDisposable: IDisposable | null = null;

    resizeFnRef.current = (cols: number, rows: number) => {
      if (!active) return;
      invoke("pty_resize", { id: ptyId, cols, rows }).catch(console.error);
    };

    const run = async () => {
      const { cols, rows } = term;
      console.log(`[pty] setup start — id=${ptyId} cols=${cols} rows=${rows}`);

      // Register data listener before creating the session so no output is missed.
      unlistenData = await listen<string>(`pty://data/${ptyId}`, (event) => {
        if (!active) return;
        const bytes = Uint8Array.from(atob(event.payload), (c) =>
          c.charCodeAt(0)
        );
        term.write(bytes);
      });

      unlistenExit = await listen<null>(`pty://exit/${ptyId}`, () => {
        term.writeln("\r\n\x1b[90m[process exited]\x1b[0m");
      });

      // Bail if cleanup ran while we were awaiting.
      if (!active) {
        unlistenData?.();
        unlistenExit?.();
        console.log(`[pty] aborted before create — id=${ptyId}`);
        return;
      }

      console.log(`[pty] invoking pty_create — id=${ptyId}`);
      await invoke("pty_create", { id: ptyId, cols, rows });
      console.log(`[pty] session created — id=${ptyId}`);

      if (!active) {
        invoke("pty_close", { id: ptyId }).catch(() => {});
        return;
      }

      // Wire keystrokes → PTY.
      onDataDisposable = term.onData((data) => {
        if (!active) return;
        invoke("pty_write", { id: ptyId, data }).catch((err) =>
          console.error("[pty_write]", err)
        );
      });

      // Re-focus after async setup so the user can type immediately.
      term.focus();
      console.log(`[pty] ready — id=${ptyId}`);
    };

    run().catch((err) => {
      console.error("[pty] setup error:", err);
      // Write the error visibly into the terminal so it's obvious if pty_create failed.
      if (active) {
        term.writeln(`\r\n\x1b[31m[slate error] ${err}\x1b[0m`);
      }
    });

    return () => {
      active = false;
      resizeFnRef.current = () => {};
      onDataDisposable?.dispose();
      unlistenData?.();
      unlistenExit?.();
      invoke("pty_close", { id: ptyId }).catch(() => {});
      console.log(`[pty] cleanup — id=${ptyId}`);
    };
  }, [terminal]);

  return { sendResize };
}
