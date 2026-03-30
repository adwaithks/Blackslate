export interface SkillInfo {
	name: string;
	description: string;
	version: string | null;
	path: string;
	source: string;
	kind: "skill" | "command";
	/** All files inside the skill directory (absolute paths). Empty for flat commands. */
	files: string[];
}

export interface ClaudeProject {
	key: string;
	path: string;
	display_name: string;
	exists: boolean;
}

export interface HookInfo {
	event: string;
	matcher: string;
	handler_type: string;
	command: string | null;
	url: string | null;
	timeout: number | null;
	run_in_background: boolean;
	disabled: boolean;
	source: string;
}

export type TopTab = "skills" | "commands" | "hooks";
export type Scope = "global" | "project";
