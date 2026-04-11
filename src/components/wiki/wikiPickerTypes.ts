export type WikiListError =
	| { kind: "ripgrep"; detail?: string }
	| { kind: "rg_access_denied"; detail?: string }
	| { kind: "rg_failed"; detail?: string }
	| { kind: "unknown"; message: string };
