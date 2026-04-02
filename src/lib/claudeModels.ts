import type { Session } from "@/store/sessionsTypes";

/**
 * Claude Code `/model` targets — single source of truth for the header picker.
 *
 * - `id` is sent verbatim: `/model <id>` (Claude Code aliases: haiku, sonnet, opus).
 * - `label` is the menu row text; `session.claudeModel` is set from Stop-hook OSC 6976 (`model=`).
 * - `matchKeywords` map that string (API slug, e.g. claude-sonnet-…) back to a row; first match wins.
 */

export interface ClaudeModelChoice {
	id: string;
	label: string;
	/** Substrings matched against lowercased parsed model text (e.g. "Sonnet 4.6"). */
	matchKeywords: readonly string[];
}

export const CLAUDE_MODEL_CHOICES: readonly ClaudeModelChoice[] = [
	{
		id: "haiku",
		label: "Haiku 4.5",
		matchKeywords: ["haiku"],
	},
	{
		id: "sonnet",
		label: "Sonnet 4.6",
		matchKeywords: ["sonnet"],
	},
	{
		id: "opus",
		label: "Opus 4.6",
		matchKeywords: ["opus"],
	},
] as const;

/** Fallback selected value when the stream has not yet reported a model. */
export const DEFAULT_CLAUDE_MODEL_ID = "sonnet";

const byId = new Map(CLAUDE_MODEL_CHOICES.map((c) => [c.id, c] as const));

export function getClaudeModelChoice(
	id: string,
): ClaudeModelChoice | undefined {
	return byId.get(id);
}

/** Label for optimistic UI; undefined if `id` is unknown. */
export function labelForClaudeModelId(id: string): string | undefined {
	return getClaudeModelChoice(id)?.label;
}

/**
 * Map `session.claudeModel` (6976 transcript slug) to a picker id, if any keyword matches.
 */
export function resolveClaudeModelIdFromParsedLabel(
	label: string | null,
): string | undefined {
	if (!label) return undefined;
	const l = label.toLowerCase();
	for (const row of CLAUDE_MODEL_CHOICES) {
		if (row.matchKeywords.some((kw) => l.includes(kw))) {
			return row.id;
		}
	}
	return undefined;
}

/** Base UI `Select` `items` prop shape. */
export function claudeModelSelectItems(): {
	value: string;
	label: string;
}[] {
	return CLAUDE_MODEL_CHOICES.map((c) => ({
		value: c.id,
		label: c.label,
	}));
}

export function buildClaudeModelSwitchPayload(modelId: string): string {
	return `/model ${modelId}\r`;
}

/** Bytes to send for a normal Claude prompt submission. */
export function buildClaudeMessagePayload(message: string): string {
	return `${message}\r`;
}

/**
 * When to show the header model picker: OS says Claude is in the PTY, or the PTY stream
 * already reflects Claude (model / state / title) while process polling may lag or miss.
 */
export function sessionShowsClaudeModelPicker(
	session: Session | undefined,
): boolean {
	if (!session) return false;
	return (
		session.claudeCodeActive ||
		session.claudeModel != null ||
		session.claudeState != null ||
		session.claudeSessionTitle != null
	);
}
