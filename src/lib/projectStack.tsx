import type { ComponentType } from "react";
import { LuCode } from "react-icons/lu";
import { SiGo, SiNodedotjs, SiPython, SiReact, SiRust } from "react-icons/si";
import type { ProjectStackItem } from "@/store/sessions";

/** UI metadata for detector ids — keep in sync when adding stacks in Rust (`project_stack.rs`). */
export const PROJECT_STACK_UI: Record<
	string,
	{ Icon: ComponentType<{ className?: string }>; order: number }
> = {
	rust: { Icon: SiRust, order: 0 },
	go: { Icon: SiGo, order: 1 },
	node: { Icon: SiNodedotjs, order: 2 },
	react: { Icon: SiReact, order: 3 },
	python: { Icon: SiPython, order: 4 },
};

const FallbackIcon = LuCode;

export function sortProjectStack(items: ProjectStackItem[]): ProjectStackItem[] {
	return [...items].sort(
		(a, b) =>
			(PROJECT_STACK_UI[a.id]?.order ?? 99) -
			(PROJECT_STACK_UI[b.id]?.order ?? 99),
	);
}

export function projectStackIcon(id: string) {
	return PROJECT_STACK_UI[id]?.Icon ?? FallbackIcon;
}
