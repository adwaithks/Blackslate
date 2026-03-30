import { useState } from "react";
import { LuBrain } from "react-icons/lu";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { GlobalTab } from "./claudeSettings/GlobalTab";
import { HooksGlobalTab } from "./claudeSettings/HooksGlobalTab";
import { HooksProjectTab } from "./claudeSettings/HooksProjectTab";
import { ProjectTab } from "./claudeSettings/ProjectTab";
import type { Scope, TopTab } from "./claudeSettings/types";

/**
 * Right sheet: browse Claude skills, slash commands, and hooks (global vs per-project).
 * Data comes from Tauri commands (`list_*`); layout is tab × scope.
 */
export function ClaudeSettingsSheet() {
	const [tab, setTab] = useState<TopTab>("skills");
	const [scope, setScope] = useState<Scope>("global");

	return (
		<Sheet>
			<SheetTrigger
				className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors rounded-sm hover:bg-white/6"
				title="Claude settings"
			>
				<LuBrain className="size-3 shrink-0" aria-hidden />
				<span>Config</span>
			</SheetTrigger>

			<SheetContent
				side="right"
				className="mt-8 flex flex-col gap-0 p-0 border-l-0"
			>
				<div className="shrink-0 flex items-center gap-2 border-b border-white/8 px-4 py-3">
					<LuBrain className="size-4 shrink-0 text-muted-foreground/60" />
					<SheetTitle className="text-sm font-semibold">
						Claude Settings
					</SheetTitle>
				</div>

				<div className="shrink-0 flex items-center gap-0 border-b border-white/8 px-4">
					{(["skills", "commands", "hooks"] as TopTab[]).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={`mr-4 cursor-pointer capitalize pb-2 pt-2.5 text-xs font-medium transition-colors border-b-2 ${
								tab === t
									? "border-foreground/80 text-foreground/80"
									: "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
							}`}
						>
							{t}
						</button>
					))}
				</div>

				<div className="shrink-0 flex items-center gap-1 border-b border-white/8 bg-white/2 px-3 py-1.5">
					{(["global", "project"] as Scope[]).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setScope(s)}
							className={`cursor-pointer rounded-sm px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
								scope === s
									? "bg-white/10 text-foreground/90"
									: "text-muted-foreground/50 hover:text-muted-foreground"
							}`}
						>
							{s}
						</button>
					))}
				</div>

				<div className="flex flex-1 min-h-0 flex-col">
					{tab === "hooks" ? (
						scope === "global" ? (
							<HooksGlobalTab />
						) : (
							<HooksProjectTab />
						)
					) : tab === "skills" ? (
						scope === "global" ? (
							<GlobalTab kind="skill" />
						) : (
							<ProjectTab kind="skill" />
						)
					) : scope === "global" ? (
						<GlobalTab kind="command" />
					) : (
						<ProjectTab kind="command" />
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
