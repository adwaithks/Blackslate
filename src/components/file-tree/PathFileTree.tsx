import { useState } from "react";
import { LuChevronRight, LuFile, LuFolder } from "react-icons/lu";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuSub,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tree model — flat absolute paths → nested map (dirs have fullPath null)
// ---------------------------------------------------------------------------

type TreeNodeModel = {
	name: string;
	fullPath: string | null;
	children: Map<string, TreeNodeModel>;
};

export function buildPathTree(files: string[], rootDir: string): TreeNodeModel {
	const root: TreeNodeModel = { name: "", fullPath: null, children: new Map() };
	for (const filePath of files) {
		const rel = filePath.startsWith(rootDir + "/")
			? filePath.slice(rootDir.length + 1)
			: (filePath.split("/").pop() ?? filePath);
		const parts = rel.split("/").filter(Boolean);
		let node = root;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			if (!node.children.has(part)) {
				node.children.set(part, {
					name: part,
					fullPath: i === parts.length - 1 ? filePath : null,
					children: new Map(),
				});
			}
			node = node.children.get(part)!;
		}
	}
	return root;
}

function sortedTreeChildren(node: TreeNodeModel): TreeNodeModel[] {
	return Array.from(node.children.values()).sort((a, b) => {
		const aDir = a.fullPath === null;
		const bDir = b.fullPath === null;
		if (aDir !== bDir) return aDir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

// ---------------------------------------------------------------------------
// Row UI
// ---------------------------------------------------------------------------

function PathTreeRow({
	node,
	selectedPath,
	onSelect,
}: {
	node: TreeNodeModel;
	selectedPath: string;
	onSelect: (path: string) => void;
}) {
	const isDir = node.fullPath === null;
	const isSelected = node.fullPath === selectedPath;
	const [open, setOpen] = useState(false);

	if (!isDir) {
		return (
			<SidebarMenuItem>
				<button
					type="button"
					onClick={() => node.fullPath && onSelect(node.fullPath)}
					className={cn(
						"flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
						isSelected
							? "bg-accent text-accent-foreground"
							: "text-foreground/70 hover:bg-white/5",
					)}
				>
					<LuFile className="size-3 shrink-0 opacity-60" />
					{node.name}
				</button>
			</SidebarMenuItem>
		);
	}

	return (
		<SidebarMenuItem>
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger
					className={cn(
						"flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5",
						"text-left text-xs text-foreground/80 transition-colors hover:bg-white/5",
					)}
				>
					<LuChevronRight
						className={cn(
							"size-3.5 shrink-0 transition-transform",
							open && "rotate-90",
						)}
					/>
					<LuFolder className="size-3 shrink-0 opacity-70" />
					{node.name}
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{sortedTreeChildren(node).map((child) => (
							<PathTreeRow
								key={child.name}
								node={child}
								selectedPath={selectedPath}
								onSelect={onSelect}
							/>
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
}

export interface PathFileTreeProps {
	files: string[];
	rootDir: string;
	selectedPath: string;
	onSelect: (path: string) => void;
}

/**
 * Collapsible sidebar tree built from a flat list of paths (e.g. absolute file paths).
 * Directories are inferred; `rootDir` strips the prefix for nesting under the first segment.
 */
export function PathFileTree({
	files,
	rootDir,
	selectedPath,
	onSelect,
}: PathFileTreeProps) {
	const root = buildPathTree(files, rootDir);
	return (
		<SidebarMenu className="gap-0 p-1 font-mono text-xs">
			{sortedTreeChildren(root).map((child) => (
				<PathTreeRow
					key={child.name}
					node={child}
					selectedPath={selectedPath}
					onSelect={onSelect}
				/>
			))}
		</SidebarMenu>
	);
}
