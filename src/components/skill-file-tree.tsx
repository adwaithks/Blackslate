import {
	PathFileTree,
	type PathFileTreeProps,
} from "@/components/file-tree/PathFileTree";

// File tree for a skill folder in the resources side panel (same widget as the generic path tree).
export function SkillFileTree(props: PathFileTreeProps) {
	return <PathFileTree {...props} />;
}

export type { PathFileTreeProps };
