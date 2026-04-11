import { LuBookOpen, LuFile } from "react-icons/lu";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";

interface WikiFilePickerDialogProps {
	scanDir: string;
	files: string[];
	loading: boolean;
	onPickFile: (absolutePath: string) => void;
	onClose: () => void;
}

function toRelativePath(absolutePath: string, scanDir: string): string {
	const prefix = scanDir.endsWith("/") ? scanDir : scanDir + "/";
	return absolutePath.startsWith(prefix)
		? absolutePath.slice(prefix.length)
		: absolutePath;
}

function fileName(absolutePath: string): string {
	const parts = absolutePath.split("/");
	return parts[parts.length - 1] ?? absolutePath;
}

function groupByTopDir(files: string[], scanDir: string): [string, string[]][] {
	const map = new Map<string, string[]>();
	for (const absPath of files) {
		const rel = toRelativePath(absPath, scanDir);
		const sep = rel.indexOf("/");
		const key = sep === -1 ? "" : rel.slice(0, sep);
		const bucket = map.get(key) ?? [];
		bucket.push(absPath);
		map.set(key, bucket);
	}
	return [...map.entries()].sort(([a], [b]) => {
		if (a === "") return -1;
		if (b === "") return 1;
		return a.localeCompare(b);
	});
}

function shortPath(dir: string): string {
	// Show last 2 segments for readability
	const parts = dir.split("/").filter(Boolean);
	if (parts.length <= 2) return "/" + parts.join("/");
	return "…/" + parts.slice(-2).join("/");
}

function SkeletonRows() {
	return (
		<CommandGroup>
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="flex items-center gap-2 px-3 py-2">
					<Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
					<Skeleton className="h-3 w-32" />
					<Skeleton className="ml-auto h-2.5 w-32" />
				</div>
			))}
		</CommandGroup>
	);
}

export function WikiFilePickerDialog({
	scanDir,
	files,
	loading,
	onPickFile,
	onClose,
}: WikiFilePickerDialogProps) {
	const groups = groupByTopDir(files, scanDir);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
			<div className="absolute inset-0 bg-black/30" aria-hidden onClick={onClose} />

			<div
				role="dialog"
				aria-label="Markdown file picker"
				className="relative w-[600px] overflow-hidden rounded-lg border border-border bg-background shadow-2xl ring-1 ring-border"
			>
				{/* Header */}
				<div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
					<LuBookOpen
						className="size-3.5 shrink-0 text-muted-foreground/60"
						aria-hidden
					/>
					<span className="text-xs font-medium text-muted-foreground/70 select-none">
						Markdown files
					</span>
					<span
						className="ml-auto max-w-[280px] truncate text-[10px] text-muted-foreground/35 select-none text-right font-mono"
						title={scanDir}
					>
						{shortPath(scanDir)}
					</span>
				</div>

				<Command className="rounded-none bg-transparent">
					<CommandInput placeholder="Search files…" autoFocus />
					<CommandList className="max-h-[420px]">
						{loading && <SkeletonRows />}

						{!loading && (
							<CommandEmpty>
								No markdown files found in this directory.
							</CommandEmpty>
						)}

						{!loading &&
							groups.map(([topDir, groupFiles]) => (
								<CommandGroup
									key={topDir || "__root__"}
									heading={topDir || "./"}
								>
									{groupFiles.map((absPath) => {
										const rel = toRelativePath(absPath, scanDir);
										const name = fileName(absPath);
										const sub =
											topDir && rel.startsWith(topDir + "/")
												? rel.slice(topDir.length + 1, -name.length - 1)
												: "";

										return (
											<CommandItem
												key={absPath}
												value={absPath}
												onSelect={() => onPickFile(absPath)}
												className="flex items-center gap-2 py-2 cursor-pointer"
											>
												<LuFile
													className="size-3.5 shrink-0 text-muted-foreground/50"
													aria-hidden
												/>
												<span className="text-xs font-semibold text-foreground/90 shrink-0">
													{name}
												</span>
												{sub && (
													<span className="truncate text-[10px] text-muted-foreground/45 leading-none">
														{sub}
													</span>
												)}
											</CommandItem>
										);
									})}
								</CommandGroup>
							))}
					</CommandList>
				</Command>
			</div>
		</div>
	);
}
