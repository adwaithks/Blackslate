import type { WikiListError } from "./wikiPickerTypes";

/**
 * Substrings in `list_md_files` `Err` messages (`src-tauri/.../wiki_files.rs`).
 * If you change the Rust prefixes, update these too.
 */
const WIKI_RG_UNAVAILABLE = "WIKI_RG_UNAVAILABLE";
const WIKI_RG_ACCESS_DENIED = "WIKI_RG_ACCESS_DENIED";
const WIKI_RG_FAILED = "WIKI_RG_FAILED";

export function formatInvokeError(e: unknown): string {
	if (typeof e === "string") return e;
	if (e instanceof Error) return e.message;
	if (e && typeof e === "object" && "message" in e) {
		const m = (e as { message?: unknown }).message;
		if (typeof m === "string") return m;
	}
	return String(e);
}

/** Map a failed `invoke` payload to structured wiki picker error state. */
export function wikiListErrorFromInvoke(e: unknown): WikiListError {
	const message = formatInvokeError(e);
	if (message.includes(WIKI_RG_UNAVAILABLE)) {
		return { kind: "ripgrep", detail: detailAfterPrefix(message, WIKI_RG_UNAVAILABLE) };
	}
	if (message.includes(WIKI_RG_ACCESS_DENIED)) {
		return {
			kind: "rg_access_denied",
			detail: detailAfterPrefix(message, WIKI_RG_ACCESS_DENIED),
		};
	}
	if (message.includes(WIKI_RG_FAILED)) {
		return { kind: "rg_failed", detail: detailAfterPrefix(message, WIKI_RG_FAILED) };
	}
	return { kind: "unknown", message };
}

function detailAfterPrefix(message: string, prefix: string): string | undefined {
	const needle = `${prefix}:`;
	const i = message.indexOf(needle);
	if (i === -1) return undefined;
	const rest = message.slice(i + needle.length).trim();
	return rest.length > 0 ? rest : undefined;
}
