import {
	PathFileTree,
	type PathFileTreeProps,
} from "@/components/file-tree/PathFileTree";

/**
 * Skill bundle file list in the Claude Code resources sheet — delegates to `PathFileTree`.
 */
export function SkillFileTree(props: PathFileTreeProps) {
	return <PathFileTree {...props} />;
}

export type { PathFileTreeProps };
