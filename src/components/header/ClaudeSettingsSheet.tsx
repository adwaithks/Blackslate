import { useState } from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { IoClose } from "react-icons/io5";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalTab } from "./claudeSettings/GlobalTab";
import { HooksGlobalTab } from "./claudeSettings/HooksGlobalTab";
import { HooksProjectTab } from "./claudeSettings/HooksProjectTab";
import { ProjectTab } from "./claudeSettings/ProjectTab";
import type { Scope, TopTab } from "./claudeSettings/types";

/**
 * Right sheet: browse Claude Code skills, slash commands, and hooks (global vs per-project).
 * Data comes from Tauri commands (`list_*`); layout is tab × scope.
 * Opened from the titlebar gear menu (no built-in trigger).
 */
export function ClaudeSettingsSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [tab, setTab] = useState<TopTab>("skills");
	const [scope, setScope] = useState<Scope>("global");

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				showCloseButton={false}
				className="mt-8 flex flex-col gap-0 p-0 border-l-0 bg-background"
			>
				<SheetTitle className="sr-only">
					Claude Code resources
				</SheetTitle>

				<Tabs
					value={tab}
					onValueChange={(v) => setTab(v as TopTab)}
					className="flex flex-col gap-0"
				>
					<div className="shrink-0 flex items-center justify-between gap-2 border-b border-border px-4 bg-background">
						<TabsList
							variant="line"
							className="h-8 w-fit min-w-0 flex-1 justify-start gap-4 rounded-none bg-transparent"
						>
							{(["skills", "commands", "hooks"] as TopTab[]).map(
								(t) => (
									<TabsTrigger
										key={t}
										value={t}
										className="h-full flex-none rounded-none px-0 text-xs font-medium capitalize"
									>
										{t}
									</TabsTrigger>
								),
							)}
						</TabsList>
						<SheetPrimitive.Close
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									className="shrink-0 -mr-1"
								/>
							}
						>
							<IoClose className="size-4" />
							<span className="sr-only">Close</span>
						</SheetPrimitive.Close>
					</div>

					<div className="shrink-0 flex items-center gap-1 border-b border-border bg-background px-3 py-1.5">
						{(["global", "project"] as Scope[]).map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setScope(s)}
								className={`cursor-pointer rounded-sm px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
									scope === s
										? "bg-muted/50 text-foreground/90"
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
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
