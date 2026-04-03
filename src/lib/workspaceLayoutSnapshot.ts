/**
 * On-disk workspace layout for restore across app restarts.
 *
 * v1 models each workspace as a single `tab_strip` root node. Future split layouts
 * can introduce new `root.kind` variants (e.g. `split_h` / `split_v`) with nested
 * tab strips per pane — keep `schemaVersion` and migrate on read.
 */

import type { Session, SessionState, Workspace } from "@/store/sessionsTypes";

export const WORKSPACE_LAYOUT_SCHEMA_VERSION = 1 as const;

/** File name under `~/.blackslate/` (see Rust `workspace_snapshot_*` and `logger::blackslate_data_root`). */
export const WORKSPACE_LAYOUT_FILE_BASENAME = "workspace-layout.json";

/**
 * On-disk document. `workspaces[].root` is a discriminated union so splits can add
 * sibling kinds without breaking v1 readers (they reject unknown kinds until migrated).
 */
export interface WorkspaceLayoutFileV1 {
	schemaVersion: typeof WORKSPACE_LAYOUT_SCHEMA_VERSION;
	activeWorkspaceId: string;
	workspaces: WorkspaceLayoutEntryV1[];
}

export interface WorkspaceLayoutEntryV1 {
	id: string;
	customName: string | null;
	root: WorkspaceRootLayoutV1;
}

export type WorkspaceRootLayoutV1 = TabStripRootV1;

/** One pane’s tab strip (today: the whole workspace body). */
export interface TabStripRootV1 {
	kind: "tab_strip";
	/** Tab order; must match permutation of `terminals[].id`. */
	order: string[];
	activeTerminalId: string;
	terminals: PersistedTerminalV1[];
}

export interface PersistedTerminalV1 {
	id: string;
	customName: string | null;
	cwd: string;
}

function emptyShellSession(id: string, cwd: string, customName: string | null): Session {
	return {
		id,
		customName,
		cwd,
		createdAt: Date.now(),
		git: null,
		ptyId: null,
		claudeCodeActive: false,
		claudeState: null,
		claudeSessionTitle: null,
		claudeModel: null,
		shellState: "idle",
		currentTool: null,
		lastTurnUsage: null,
		cumulativeUsage: null,
	};
}

/** Serialise in-memory session state to the v1 file JSON string. */
export function serializeWorkspaceLayout(state: SessionState): string {
	const workspaces: WorkspaceLayoutEntryV1[] = state.workspaces.map((w) => ({
		id: w.id,
		customName: w.customName,
		root: {
			kind: "tab_strip",
			order: w.sessions.map((s) => s.id),
			activeTerminalId: w.activeSessionId,
			terminals: w.sessions.map((s) => ({
				id: s.id,
				customName: s.customName,
				cwd: s.cwd,
			})),
		},
	}));

	const doc: WorkspaceLayoutFileV1 = {
		schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
		activeWorkspaceId: state.activeWorkspaceId,
		workspaces,
	};

	return `${JSON.stringify(doc, null, 0)}\n`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
	return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseTabStripRoot(raw: unknown): TabStripRootV1 | null {
	if (!isRecord(raw) || raw.kind !== "tab_strip") return null;
	const order = raw.order;
	const terminals = raw.terminals;
	const activeTerminalId = raw.activeTerminalId;
	if (!Array.isArray(order) || !Array.isArray(terminals)) return null;
	if (typeof activeTerminalId !== "string" || !activeTerminalId) return null;
	const termList: PersistedTerminalV1[] = [];
	for (const t of terminals) {
		if (!isRecord(t)) return null;
		if (typeof t.id !== "string" || !t.id) return null;
		if (typeof t.cwd !== "string") return null;
		const cn = t.customName;
		if (cn !== null && cn !== undefined && typeof cn !== "string") return null;
		termList.push({
			id: t.id,
			customName: cn ?? null,
			cwd: t.cwd,
		});
	}
	const orderIds = order.filter((x): x is string => typeof x === "string" && x.length > 0);
	if (orderIds.length === 0) return null;
	const idSet = new Set(termList.map((x) => x.id));
	if (idSet.size !== termList.length) return null;
	for (const id of orderIds) {
		if (!idSet.has(id)) return null;
	}
	if (!idSet.has(activeTerminalId)) return null;
	if (orderIds.length !== idSet.size) return null;
	return {
		kind: "tab_strip",
		order: orderIds,
		activeTerminalId,
		terminals: termList,
	};
}

function workspaceFromTabStrip(
	wId: string,
	customName: string | null,
	strip: TabStripRootV1,
): Workspace | null {
	const byId = new Map(strip.terminals.map((t) => [t.id, t] as const));
	const sessions: Session[] = [];
	for (const id of strip.order) {
		const t = byId.get(id);
		if (!t) return null;
		sessions.push(emptyShellSession(t.id, t.cwd, t.customName));
	}
	if (sessions.length === 0) return null;
	if (!sessions.some((s) => s.id === strip.activeTerminalId)) return null;
	return {
		id: wId,
		customName,
		sessions,
		activeSessionId: strip.activeTerminalId,
	};
}

/** Parse JSON bytes from disk; return `null` if invalid or unsupported (caller falls back). */
export function parseWorkspaceLayoutToSessionState(
	json: string,
): SessionState | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json) as unknown;
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;

	const ver = parsed.schemaVersion;
	if (ver !== WORKSPACE_LAYOUT_SCHEMA_VERSION) return null;

	const activeWorkspaceId = parsed.activeWorkspaceId;
	const workspacesRaw = parsed.workspaces;
	if (typeof activeWorkspaceId !== "string" || !activeWorkspaceId) return null;
	if (!Array.isArray(workspacesRaw) || workspacesRaw.length === 0) return null;

	const workspaces: Workspace[] = [];
	for (const w of workspacesRaw) {
		if (!isRecord(w)) return null;
		if (typeof w.id !== "string" || !w.id) return null;
		const cn = w.customName;
		if (cn !== null && cn !== undefined && typeof cn !== "string") return null;
		const strip = parseTabStripRoot(w.root);
		if (!strip) return null;
		const ws = workspaceFromTabStrip(w.id, cn ?? null, strip);
		if (!ws) return null;
		workspaces.push(ws);
	}

	const wsIds = new Set(workspaces.map((x) => x.id));
	if (!wsIds.has(activeWorkspaceId)) return null;

	return { workspaces, activeWorkspaceId };
}
