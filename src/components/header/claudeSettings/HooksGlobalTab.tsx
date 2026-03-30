import { useState } from "react";
import { LuSearch } from "react-icons/lu";
import type { HookInfo } from "./types";
import { HookItem } from "./HookItem";
import { HookViewer } from "./HookViewer";
import { useGlobalHooks } from "./useGlobalHooks";

export function HooksGlobalTab() {
	const { hooks, loading } = useGlobalHooks();
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<HookInfo | null>(null);

	const filtered = query.trim()
		? hooks.filter(
				(h) =>
					h.event.toLowerCase().includes(query.toLowerCase()) ||
					(h.command ?? "")
						.toLowerCase()
						.includes(query.toLowerCase()) ||
					(h.url ?? "").toLowerCase().includes(query.toLowerCase()) ||
					h.matcher.toLowerCase().includes(query.toLowerCase()),
			)
		: hooks;

	return (
		<div className="flex flex-1 min-h-0 gap-0">
			<div className="flex w-[240px] shrink-0 flex-col border-r border-white/8">
				<div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
					<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Filter hooks…"
						className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
					/>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto p-1">
					{loading && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							Loading…
						</div>
					)}
					{!loading && filtered.length === 0 && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							{query ? "No matches" : "No global hooks"}
						</div>
					)}
					{filtered.map((hook, i) => (
						<HookItem
							key={`${hook.event}-${hook.matcher}-${i}`}
							hook={hook}
							selected={selected === hook}
							onClick={() => setSelected(hook)}
						/>
					))}
				</div>
			</div>
			<div className="flex flex-1 min-h-0 flex-col">
				<HookViewer hook={selected} />
			</div>
		</div>
	);
}
