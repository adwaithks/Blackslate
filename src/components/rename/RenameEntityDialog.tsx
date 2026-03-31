import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { IoClose } from "react-icons/io5";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	findSession,
	useSessionStore,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/sessions";
import { useRenameUiStore } from "@/store/renameUiStore";

/**
 * Modal to rename a workspace or terminal tab — shell matches {@link SettingsDialog}.
 */
export function RenameEntityDialog() {
	const target = useRenameUiStore((s) => s.target);
	const closeUi = useRenameUiStore((s) => s.close);
	const workspaces = useSessionStore((s) => s.workspaces);
	const setSessionCustomName = useSessionStore((s) => s.setSessionCustomName);
	const setWorkspaceCustomName = useSessionStore(
		(s) => s.setWorkspaceCustomName,
	);

	const open = target !== null;

	const initialName =
		target === null
			? ""
			: target.kind === "session"
				? (() => {
						const s = findSession(workspaces, target.sessionId);
						return s ? terminalDisplayName(s) : "";
					})()
				: (() => {
						const w = workspaces.find((x) => x.id === target.workspaceId);
						return w ? workspaceDisplayName(w) : "";
					})();

	const [value, setValue] = useState(initialName);

	useEffect(() => {
		if (open) setValue(initialName);
	}, [open, initialName]);

	const title =
		target?.kind === "workspace" ? "Rename workspace" : "Rename tab";

	function handleSave() {
		if (!target) return;
		const trimmed = value.trim();
		if (target.kind === "session") {
			setSessionCustomName(target.sessionId, trimmed || null);
		} else {
			setWorkspaceCustomName(target.workspaceId, trimmed || null);
		}
		closeUi();
	}

	return (
		<Dialog.Root open={open} onOpenChange={(o) => !o && closeUi()}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />

				<Dialog.Popup
					className={cn(
						"fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
						"bg-[#0a0a0a] border border-white/[0.07] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.8)]",
						"flex flex-col overflow-hidden",
						"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
						"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
						"duration-150",
					)}
				>
					<div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
						<Dialog.Title className="text-xs font-medium tracking-wide text-white/60">
							{title}
						</Dialog.Title>
						<button
							type="button"
							className="flex size-5 cursor-pointer items-center justify-center rounded text-white/25 transition-colors hover:text-white/60"
							aria-label="Close"
							onClick={() => closeUi()}
						>
							<IoClose className="size-4" />
						</button>
					</div>

					<div className="flex flex-col gap-4 p-4">
						<Input
							autoFocus
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSave();
								}
							}}
							placeholder="Name"
							className="h-9 border-white/10 bg-white/[0.03] text-[#eceae6] placeholder:text-white/25"
						/>

						<div className="flex justify-end gap-2">
							<button
								type="button"
								className="rounded-md px-3 py-1.5 text-xs text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/70"
								onClick={() => closeUi()}
							>
								Cancel
							</button>
							<Button
								type="button"
								size="sm"
								className="bg-white/12 text-[#eceae6] hover:bg-white/18"
								onClick={handleSave}
							>
								Save
							</Button>
						</div>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
