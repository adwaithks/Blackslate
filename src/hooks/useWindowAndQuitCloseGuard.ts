import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirmCloseWindow } from "@/lib/closeConfirm";
import { flushWorkspaceLayoutNow } from "@/lib/persistWorkspaceLayout";

/**
 * Intercepts window close and menu Quit (⌘⇧Q): always show a native confirm first.
 *
 * Tauri requires `preventDefault()` on close to run synchronously — you cannot await a
 * dialog first. We always prevent, then confirm, then call `close()` / `quit_app` after
 * the user accepts (see https://github.com/tauri-apps/tauri/issues/12334). After confirm,
 * call `invoke("quit_app")` — do not use `window.destroy()` or `close()` from this handler;
 * on macOS (especially with overlay titlebar) those often fail from the webview while
 * the Rust `exit` path matches the working menu Quit flow.
 *
 * Async registration is cancelled on effect cleanup so React Strict Mode (dev double-mount)
 * does not leave two `onCloseRequested` listeners — which would show the confirm twice.
 */
export function useWindowAndQuitCloseGuard(): void {
	useEffect(() => {
		let cancelled = false;
		let unlistenQuit: UnlistenFn | undefined;
		let unlistenClose: UnlistenFn | undefined;

		const setup = async () => {
			const win = getCurrentWindow();

			const finishClose = async () => {
				try {
					await flushWorkspaceLayoutNow();
				} catch (e) {
					console.error("[workspace layout] flush on quit failed", e);
				}
				await invoke("quit_app");
			};

			unlistenQuit = await listen("blackslate://confirm-quit", async () => {
				try {
					const ok = await confirmCloseWindow();
					if (ok) {
						await finishClose();
					}
				} catch (e) {
					console.error("[quit] confirm failed", e);
				}
			});
			if (cancelled) {
				unlistenQuit();
				return;
			}

			unlistenClose = await win.onCloseRequested(async (event) => {
				event.preventDefault();
				try {
					const ok = await confirmCloseWindow();
					if (ok) {
						await finishClose();
					}
				} catch (e) {
					console.error("[close] confirm failed", e);
				}
			});
			if (cancelled) {
				unlistenQuit();
				unlistenClose();
			}
		};

		void setup();

		return () => {
			cancelled = true;
			unlistenQuit?.();
			unlistenClose?.();
		};
	}, []);
}
