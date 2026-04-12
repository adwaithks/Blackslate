import { memo, useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { IoClose } from "react-icons/io5";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	findTerminal,
	useTerminalStore,
	terminalDisplayName,
	workspaceDisplayName,
} from "@/store/terminals";
import { useRenameUiStore } from "@/store/renameUiStore";

// Small uppercase label, same style as in settings.
function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="pb-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
			{children}
		</p>
	);
}

// Popup to rename a workspace or a tab; looks like the settings dialog.
function RenameEntityDialogImpl() {
	const target = useRenameUiStore((s) => s.target);
	const closeUi = useRenameUiStore((s) => s.close);
	const workspaces = useTerminalStore((s) => s.workspaces);
	const setTerminalCustomName = useTerminalStore((s) => s.setTerminalCustomName);
	const setWorkspaceCustomName = useTerminalStore(
		(s) => s.setWorkspaceCustomName,
	);

	const open = target !== null;

	const initialName =
		target === null
			? ""
			: target.kind === "terminal"
				? (() => {
						const s = findTerminal(workspaces, target.terminalId);
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

	const scopeLabel =
		target?.kind === "workspace" ? "Workspace" : "Terminal";

	function handleSave() {
		if (!target) return;
		const trimmed = value.trim();
		if (target.kind === "terminal") {
			setTerminalCustomName(target.terminalId, trimmed || null);
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
						"flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.8)]",
						"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
						"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
						"duration-150",
					)}
				>
					<div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
						<Dialog.Title className="text-xs font-medium tracking-wide text-muted-foreground">
							Rename
						</Dialog.Title>
						<button
							type="button"
							className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground"
							aria-label="Close"
							onClick={() => closeUi()}
						>
							<IoClose className="size-4" />
						</button>
					</div>

					<div className="flex flex-col gap-5 p-4">
						<section className="flex flex-col gap-2">
							<SectionLabel>{scopeLabel}</SectionLabel>
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
								className="h-9 border-border bg-input/30 text-foreground placeholder:text-muted-foreground/50"
							/>
						</section>

						<div className="flex justify-end gap-2">
							<button
								type="button"
								className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
								onClick={() => closeUi()}
							>
								Cancel
							</button>
							<Button
								type="button"
								size="sm"
								className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
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

export const RenameEntityDialog = memo(RenameEntityDialogImpl);
