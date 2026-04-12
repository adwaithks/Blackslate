import type { WikiListError } from "./wikiPickerTypes";

// Text snippets the wiki file list returns on failure — keep in sync with the Rust side if those strings change.
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

// Turn a thrown error from the wiki search into a small labeled object for the UI.
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
