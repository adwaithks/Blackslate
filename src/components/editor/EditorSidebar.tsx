import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	LuChevronRight,
	LuFolder,
	LuFolderOpen,
	LuFile,
	LuFileCode,
	LuFileJson,
	LuFileText,
	LuRefreshCw,
} from "react-icons/lu";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEditorStore } from "@/store/editor";
import { detectLanguage } from "@/lib/editorLanguages";
import { useSettingsStore } from "@/store/settings";
import { getFileTreePalette } from "@/lib/editorThemes";
import type { FileTreePalette } from "@/lib/editorThemes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileEntry {
	name: string;
	path: string;
	is_dir: boolean;
	ext: string | null;
}

// ---------------------------------------------------------------------------
// File icon helper
// ---------------------------------------------------------------------------

function FileIcon({
	ext,
	name,
	palette,
}: {
	ext: string | null;
	name: string;
	palette: FileTreePalette;
}) {
	const lower = ext ?? name.toLowerCase();
	const cls = "size-3.5 shrink-0";

	if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"].includes(lower))
		return <LuFileCode className={cls} style={{ color: palette.code }} />;
	if (
		["rs", "go", "java", "c", "cpp", "h", "hpp", "cs", "swift"].includes(
			lower,
		)
	)
		return <LuFileCode className={cls} style={{ color: palette.code }} />;
	if (["py", "rb", "php", "sh", "bash", "zsh", "fish"].includes(lower))
		return <LuFileCode className={cls} style={{ color: palette.code }} />;
	if (["json", "jsonc", "toml", "yaml", "yml", "sql", "env"].includes(lower))
		return <LuFileJson className={cls} style={{ color: palette.data }} />;
	if (["html", "htm", "css", "scss", "less", "svelte", "vue"].includes(lower))
		return <LuFileCode className={cls} style={{ color: palette.markup }} />;
	if (["md", "mdx", "txt", "rst", "org"].includes(lower))
		return <LuFileText className={cls} style={{ color: palette.prose }} />;
	return <LuFile className={cls} style={{ color: palette.default }} />;
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

interface NodeProps {
	entry: FileEntry;
	depth: number;
	childCache: Map<string, FileEntry[]>;
	loadingDirs: Set<string>;
	activeFilePath: string | null;
	palette: FileTreePalette;
	onDirExpand: (entry: FileEntry) => void;
	onFileOpen: (entry: FileEntry) => void;
}

function FileTreeNode({
	entry,
	depth,
	childCache,
	loadingDirs,
	activeFilePath,
	palette,
	onDirExpand,
	onFileOpen,
}: NodeProps) {
	const indent = depth * 10 + 8;
	const [open, setOpen] = useState(false);

	const handleDirToggle = useCallback(
		(next: boolean) => {
			setOpen(next);
			if (next && !childCache.has(entry.path)) {
				onDirExpand(entry);
			}
		},
		[entry, childCache, onDirExpand],
	);

	if (entry.is_dir) {
		const children = childCache.get(entry.path) ?? [];
		const loading = loadingDirs.has(entry.path);

		return (
			<Collapsible open={open} onOpenChange={handleDirToggle}>
				<CollapsibleTrigger
					className="w-full flex items-center gap-1 py-[3px] cursor-pointer select-none text-[11px] text-muted-foreground/70 hover:text-muted-foreground hover:bg-white/[0.04] transition-colors"
					style={{ paddingLeft: indent }}
				>
					<LuChevronRight
						className={[
							"size-3 shrink-0 text-muted-foreground/40 transition-transform duration-150",
							open ? "rotate-90" : "",
						].join(" ")}
					/>
					{open ? (
						<LuFolderOpen
							className="size-3.5 shrink-0"
							style={{ color: palette.folder }}
						/>
					) : (
						<LuFolder
							className="size-3.5 shrink-0"
							style={{ color: palette.folder, opacity: 0.8 }}
						/>
					)}
					<span className="truncate min-w-0">{entry.name}</span>
					{loading && (
						<LuRefreshCw className="size-2.5 shrink-0 ml-auto mr-2 animate-spin text-muted-foreground/30" />
					)}
				</CollapsibleTrigger>

				<CollapsibleContent>
					{open &&
						children.map((child) => (
							<FileTreeNode
								key={child.path}
								entry={child}
								depth={depth + 1}
								childCache={childCache}
								loadingDirs={loadingDirs}
								activeFilePath={activeFilePath}
								palette={palette}
								onDirExpand={onDirExpand}
								onFileOpen={onFileOpen}
							/>
						))}
				</CollapsibleContent>
			</Collapsible>
		);
	}

	const isActive = entry.path === activeFilePath;

	return (
		<button
			className={[
				"w-full flex items-center gap-1.5 py-[3px] cursor-pointer select-none",
				"text-[11px] transition-colors text-left",
				isActive
					? "bg-white/[0.08] text-foreground"
					: "text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/[0.04]",
			].join(" ")}
			style={{ paddingLeft: indent + 14 }}
			onClick={() => onFileOpen(entry)}
		>
			<FileIcon ext={entry.ext} name={entry.name} palette={palette} />
			<span className="truncate min-w-0">{entry.name}</span>
		</button>
	);
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

/** key=rootPath so the whole component re-mounts (clears cache) on directory change */
export function EditorSidebar({ width = 220 }: { width?: number }) {
	const { rootPath, activeFilePath, openFile } = useEditorStore();
	const { terminalTheme } = useSettingsStore();
	const palette = getFileTreePalette(terminalTheme);

	const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
	const [childCache, setChildCache] = useState<Map<string, FileEntry[]>>(
		new Map(),
	);
	const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (!rootPath) return;
		setRootEntries([]);
		setChildCache(new Map());
		setLoadingDirs(new Set());
		setLoadError(null);

		invoke<FileEntry[]>("fs_list_dir", {
			path: rootPath,
			showHidden: false,
		})
			.then(setRootEntries)
			.catch((e) => setLoadError(String(e)));
	}, [rootPath]);

	const handleDirExpand = useCallback(
		async (entry: FileEntry) => {
			if (childCache.has(entry.path)) return;
			setLoadingDirs((prev) => new Set(prev).add(entry.path));
			try {
				const children = await invoke<FileEntry[]>("fs_list_dir", {
					path: entry.path,
					showHidden: false,
				});
				setChildCache((prev) =>
					new Map(prev).set(entry.path, children),
				);
			} catch (e) {
				console.error("fs_list_dir failed:", e);
			} finally {
				setLoadingDirs((prev) => {
					const next = new Set(prev);
					next.delete(entry.path);
					return next;
				});
			}
		},
		[childCache],
	);

	const handleFileOpen = useCallback(
		async (entry: FileEntry) => {
			const { openFiles } = useEditorStore.getState();
			if (openFiles.find((f) => f.path === entry.path)) {
				useEditorStore.getState().setActiveFile(entry.path);
				return;
			}
			try {
				const content = await invoke<string>("fs_read_file", {
					path: entry.path,
				});
				const language = detectLanguage(entry.name);
				openFile(entry.path, entry.name, content, language);
			} catch (e) {
				openFile(entry.path, entry.name, `// ${String(e)}`, "text");
			}
		},
		[openFile],
	);

	const rootName = rootPath?.split("/").pop() ?? rootPath ?? "Files";

	return (
		<div
			className="flex flex-col h-full border-r border-border overflow-hidden"
			style={{
				width,
				minWidth: width,
				backgroundColor: "var(--chrome-sidebar-surface)",
			}}
		>
			{/* Header */}
			<div className="h-8 flex items-center px-3 border-b border-border shrink-0">
				<span
					className="text-[11px] font-semibold text-muted-foreground/60 truncate uppercase tracking-wider select-none"
					title={rootPath ?? ""}
				>
					{rootName}
				</span>
			</div>

			{/* Tree */}
			<div className="flex-1 overflow-y-auto py-1 editor-tree-scroll">
				{loadError ? (
					<div className="px-3 py-2 text-[10px] text-red-400/60 font-mono">
						{loadError}
					</div>
				) : rootEntries.length === 0 && rootPath ? (
					<div className="px-3 py-2 text-[10px] text-muted-foreground/30 select-none">
						Empty directory
					</div>
				) : (
					rootEntries.map((entry) => (
						<FileTreeNode
							key={entry.path}
							entry={entry}
							depth={0}
							childCache={childCache}
							loadingDirs={loadingDirs}
							activeFilePath={activeFilePath}
							palette={palette}
							onDirExpand={handleDirExpand}
							onFileOpen={handleFileOpen}
						/>
					))
				)}
			</div>
		</div>
	);
}
