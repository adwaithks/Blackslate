import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LuBookOpen } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { selectActiveTerminal, useTerminalStore } from "@/store/terminals";
import { WikiFilePickerDialog } from "./WikiFilePickerDialog";
import { usePickerDismiss } from "@/components/header/claudeSessionPicker/usePickerDismiss";
import { requestActiveTerminalFocus } from "@/lib/focusActiveTerminal";
import { toastError } from "@/lib/toastError";
import { wikiListErrorFromInvoke } from "./wikiRipgrep";
import type { WikiListError } from "./wikiPickerTypes";

interface WikiFilePickerProps {
	cwd: string;
}

interface ListMdFilesResult {
	scanDir: string;
	files: string[];
}

export function WikiFilePicker({ cwd }: WikiFilePickerProps) {
	const [open, setOpen] = useState(false);
	const [files, setFiles] = useState<string[]>([]);
	const [scanDir, setScanDir] = useState<string>(cwd);
	const [loading, setLoading] = useState(false);
	const [listError, setListError] = useState<WikiListError | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const close = useCallback(() => {
		setOpen(false);
		requestActiveTerminalFocus();
	}, []);
	usePickerDismiss(open, close, containerRef);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setLoading(true);
		setListError(null);
		setFiles([]);
		setScanDir(cwd);
		invoke<ListMdFilesResult>("list_md_files", { dir: cwd })
			.then((result) => {
				if (!cancelled) {
					setFiles(result.files);
					setScanDir(result.scanDir);
				}
			})
			.catch((e) => {
				if (cancelled) return;
				setListError(wikiListErrorFromInvoke(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, cwd]);

	function handlePickFile(absolutePath: string) {
		const active = selectActiveTerminal(useTerminalStore.getState());
		if (!active?.ptyId) return;
		invoke("pty_write", {
			id: active.ptyId,
			data: `${active.claudeCodeActive ? "@" : ""}${absolutePath} `,
		}).catch((e) => toastError("Could not insert path into terminal", e));
		setOpen(false);
		requestActiveTerminalFocus();
	}

	return (
		<div ref={containerRef} className="flex items-center">
			<Button
				type="button"
				variant="ghost"
				size="xs"
				onClick={() => setOpen((o) => !o)}
				title="Browse markdown files (⌘⇧M)"
				aria-label="Browse markdown files"
				aria-pressed={open}
				className="h-6 gap-1 px-2 text-muted-foreground hover:text-foreground"
			>
				<LuBookOpen className="size-4 shrink-0" aria-hidden />
			</Button>

			{open && (
				<WikiFilePickerDialog
					scanDir={scanDir}
					files={files}
					loading={loading}
					listError={listError}
					onPickFile={handlePickFile}
					onClose={close}
				/>
			)}
		</div>
	);
}
