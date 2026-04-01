import { useCallback, useRef, useState } from "react";
import { LuFolder, LuSearch } from "react-icons/lu";
import type { ClaudeProject } from "./types";
import { useClaudeProjects } from "./useClaudeProjects";
import { useDismissOnOutsideClick } from "./useDismissOnOutsideClick";

export function ProjectPicker({
	selected,
	onSelect,
}: {
	selected: ClaudeProject | null;
	onSelect: (p: ClaudeProject) => void;
}) {
	const projects = useClaudeProjects();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const close = useCallback(() => setOpen(false), []);
	useDismissOnOutsideClick(open, close, ref);

	const filtered = query.trim()
		? projects.filter(
				(p) =>
					p.display_name
						.toLowerCase()
						.includes(query.toLowerCase()) ||
					p.path.toLowerCase().includes(query.toLowerCase()),
			)
		: projects;

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full cursor-pointer items-center gap-2 rounded-sm border border-border bg-muted/30 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50"
			>
				<LuFolder className="size-3 shrink-0 text-muted-foreground/50" />
				<span className="flex-1 text-left truncate">
					{selected ? (
						<>
							<span className="text-foreground/80">
								{selected.display_name}
							</span>
							<span className="ml-1.5 text-muted-foreground/40 font-mono text-[10px]">
								{selected.path}
							</span>
						</>
					) : (
						<span className="text-muted-foreground/40">
							Select a project…
						</span>
					)}
				</span>
			</button>
			{open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-xl">
					<div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
						<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
						<input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search projects…"
							className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
						/>
					</div>
					<div className="max-h-[200px] overflow-y-auto p-1">
						{filtered.length === 0 && (
							<div className="py-3 text-center text-xs text-muted-foreground/40">
								No projects found
							</div>
						)}
						{filtered.map((p) => (
							<button
								key={p.key}
								type="button"
								onClick={() => {
									onSelect(p);
									setOpen(false);
									setQuery("");
								}}
								className="flex w-full cursor-pointer items-start gap-2 rounded-sm px-2.5 py-1.5 text-left transition-colors hover:bg-muted/45"
							>
								<LuFolder className="mt-0.5 size-3 shrink-0 text-muted-foreground/40" />
								<div>
									<div className="text-xs font-medium leading-snug">
										{p.display_name}
									</div>
									<div className="text-[10px] font-mono text-muted-foreground/40 leading-snug">
										{p.path}
									</div>
								</div>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
