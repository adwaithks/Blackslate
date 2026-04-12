import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { confirmCloseWindow } from "@/lib/closeConfirm";
import { toastError } from "@/lib/toastError";

// Ask "are you sure?" before closing the window or using Quit from the menu.
// The app has to block closing first, then show the dialog, then exit if you agree.
// Cleanup removes listeners so dev mode doesn't register twice and show two dialogs.
export function useWindowAndQuitCloseGuard(): void {
	useEffect(() => {
		let cancelled = false;
		let unlistenQuit: UnlistenFn | undefined;
		let unlistenClose: UnlistenFn | undefined;

		const setup = async () => {
			const win = getCurrentWindow();

			const finishClose = async () => {
				await invoke("quit_app");
			};

			unlistenQuit = await listen("blackslate://confirm-quit", async () => {
				try {
					const ok = await confirmCloseWindow();
					if (ok) {
						await finishClose();
					}
				} catch (e) {
					toastError("Could not quit", e);
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
					toastError("Could not close window", e);
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
