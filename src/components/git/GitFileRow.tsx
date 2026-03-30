import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GitFile } from "@/components/git/gitTypes";

export interface GitFileRowAction {
	icon: ReactNode;
	label: string;
	danger?: boolean;
	onClick: () => void;
}

export function GitFileRow({
	file,
	actions,
}: {
	file: GitFile;
	actions: GitFileRowAction[];
}) {
	const segments = file.path.split("/");
	const filename = segments.pop() ?? file.path;
	const dir = segments.length > 0 ? `${segments.join("/")}/` : "";
	const binary = file.additions < 0 || file.deletions < 0;

	return (
		<div className="group flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1 hover:bg-muted/20">
			<div className="min-w-0 flex-1 flex justify-start overflow-hidden">
				<div
					className="flex min-w-0 flex-1 items-baseline gap-0.5 overflow-hidden text-left"
					title={file.path}
				>
					{dir ? (
						<span
							className="min-w-0 shrink overflow-hidden text-[11px] leading-tight text-muted-foreground/55"
							dir="rtl"
						>
							<span
								dir="ltr"
								className="block truncate text-left"
							>
								{dir}
							</span>
						</span>
					) : null}
					<span
						className={cn(
							"text-xs leading-tight text-foreground/85 min-w-0 text-left",
							dir ? "shrink-0" : "min-w-0 flex-1 truncate",
						)}
					>
						{filename}
					</span>
				</div>
			</div>

			<div className="relative flex h-5 w-[52px] shrink-0 items-center justify-end">
				<div
					className={cn(
						"flex items-center justify-end gap-1 text-[11px] tabular-nums transition-opacity duration-100",
						"group-hover:pointer-events-none group-hover:opacity-0",
					)}
				>
					{binary ? (
						<span className="text-[10px] text-muted-foreground/40">
							bin
						</span>
					) : (
						<>
							<span
								className={
									file.additions > 0
										? "text-green-500/75"
										: "text-muted-foreground/30"
								}
							>
								+{file.additions}
							</span>
							<span
								className={
									file.deletions > 0
										? "text-red-500/75"
										: "text-muted-foreground/30"
								}
							>
								−{file.deletions}
							</span>
						</>
					)}
				</div>
				<div
					className={cn(
						"absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-100",
						"group-hover:opacity-100",
					)}
				>
					{actions.map((a) => (
						<Button
							key={a.label}
							variant="ghost"
							size="sm"
							onClick={a.onClick}
							title={a.label}
							className={cn(
								"h-5 w-5 p-0",
								a.danger
									? "text-muted-foreground hover:text-destructive"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{a.icon}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}
