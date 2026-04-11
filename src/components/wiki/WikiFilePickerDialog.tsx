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
	cwd: string;
	files: string[];
	loading: boolean;
	onPickFile: (absolutePath: string) => void;
	onClose: () => void;
}

function toRelativePath(absolutePath: string, cwd: string): string {
	const prefix = cwd.endsWith("/") ? cwd : cwd + "/";
	return absolutePath.startsWith(prefix)
		? absolutePath.slice(prefix.length)
		: absolutePath;
}

function fileName(absolutePath: string): string {
	const parts = absolutePath.split("/");
	return parts[parts.length - 1] ?? absolutePath;
}

/**
 * Groups files by their first path segment relative to cwd.
 * Files sitting directly in cwd (no subdirectory) go under the "" key (rendered as root).
 * Returns entries sorted: root first, then alphabetically.
 */
function groupByTopDir(files: string[], cwd: string): [string, string[]][] {
	const map = new Map<string, string[]>();
	for (const absPath of files) {
		const rel = toRelativePath(absPath, cwd);
		const sep = rel.indexOf("/");
		const key = sep === -1 ? "" : rel.slice(0, sep);
		const bucket = map.get(key) ?? [];
		bucket.push(absPath);
		map.set(key, bucket);
	}
	// Root ("") first, then the rest alphabetically
	return [...map.entries()].sort(([a], [b]) => {
		if (a === "") return -1;
		if (b === "") return 1;
		return a.localeCompare(b);
	});
}

function SkeletonRows() {
	return (
		<>
			{Array.from({ length: 3 }).map((_, g) => (
				<CommandGroup key={g}>
					<div className="flex items-center gap-2 px-2 py-1">
						<Skeleton className="h-2.5 w-20" />
					</div>
					{Array.from({ length: 2 + g }).map((_, i) => (
						<div key={i} className="flex items-center gap-2 px-3 py-2">
							<Skeleton className="h-3 w-3 shrink-0 rounded-sm" />
							<Skeleton className="h-3 w-28" />
							<Skeleton className="ml-auto h-2.5 w-32" />
						</div>
					))}
				</CommandGroup>
			))}
		</>
	);
}

export function WikiFilePickerDialog({
	cwd,
	files,
	loading,
	onPickFile,
	onClose,
}: WikiFilePickerDialogProps) {
	const groups = groupByTopDir(files, cwd);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
			<div className="absolute inset-0 bg-black/30" aria-hidden onClick={onClose} />

			<div
				role="dialog"
				aria-label="Markdown file picker"
				className="relative w-[600px] overflow-hidden rounded-lg border border-border bg-background shadow-2xl ring-1 ring-border"
			>
				<Command className="rounded-none bg-transparent">
					<div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
						<LuBookOpen
							className="size-3.5 shrink-0 text-muted-foreground/60"
							aria-hidden
						/>
						<span className="text-xs font-medium text-muted-foreground/70 select-none">
							Markdown files
						</span>
						<span className="ml-auto text-[10px] text-muted-foreground/35 select-none truncate">
							{cwd}
						</span>
					</div>

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
										const rel = toRelativePath(absPath, cwd);
										const name = fileName(absPath);
										// Sub-path within this group (strip the top dir prefix)
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
