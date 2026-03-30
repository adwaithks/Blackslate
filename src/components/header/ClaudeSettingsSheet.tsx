import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	LuSearch,
	LuPackage,
	LuFolder,
	LuChevronRight,
	LuZap,
	LuGlobe,
	LuMessageSquare,
	LuBrain,
} from "react-icons/lu";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { SkillFileTree } from "@/components/skill-file-tree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillInfo {
	name: string;
	description: string;
	version: string | null;
	path: string;
	source: string;
	kind: "skill" | "command";
	/** All files inside the skill directory (absolute paths). Empty for flat commands. */
	files: string[];
}

interface ClaudeProject {
	key: string;
	path: string;
	display_name: string;
	exists: boolean;
}

interface HookInfo {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip YAML frontmatter (---…---) from markdown content. */
function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const rest = content.slice(3);
	const end = rest.indexOf("\n---");
	if (end === -1) return content;
	return rest.slice(end + 4).trimStart();
}

// ---------------------------------------------------------------------------
// Skill list item
// ---------------------------------------------------------------------------

function SkillItem({
	skill,
	selected,
	onClick,
}: {
	skill: SkillInfo;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full cursor-pointer text-left px-3 py-2.5 rounded-sm transition-colors ${
				selected
					? "bg-accent text-accent-foreground"
					: "hover:bg-white/5 text-foreground/80"
			}`}
		>
			<div className="text-xs font-medium leading-snug truncate">
				{skill.name}
			</div>
			{skill.description && (
				<div className="text-[10px] text-muted-foreground/55 leading-snug mt-0.5 line-clamp-2">
					{skill.description}
				</div>
			)}
			<div className="flex items-center gap-1.5 mt-1">
				<span className="text-[10px] font-mono text-muted-foreground/40 truncate">
					{skill.source}
				</span>
				{skill.version && (
					<span className="text-[10px] text-muted-foreground/35">
						v{skill.version}
					</span>
				)}
			</div>
		</button>
	);
}

// ---------------------------------------------------------------------------
// File tree + content viewer
// ---------------------------------------------------------------------------

function relativeParts(filePath: string, rootDir: string): string[] {
	const rel = filePath.startsWith(rootDir + "/")
		? filePath.slice(rootDir.length + 1)
		: filePath;
	return rel.split("/").filter(Boolean);
}

function FileContent({
	path,
	rootDir,
	isSkillMd,
}: {
	path: string;
	rootDir: string;
	isSkillMd: boolean;
}) {
	const [content, setContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		setLoading(true);
		invoke<string | null>("read_skill_content", { path })
			.then((c) => setContent(c ?? null))
			.catch(() => setContent(null))
			.finally(() => setLoading(false));
	}, [path]);

	const parts = relativeParts(path, rootDir);

	return (
		<div className="flex h-full flex-col min-h-0">
			{/* Breadcrumb */}
			<div className="shrink-0 flex items-center gap-1 border-b border-white/8 px-4 py-2 text-[11px] text-muted-foreground/50">
				{parts.map((part, i) => (
					<span key={i} className="flex items-center gap-1">
						{i > 0 && (
							<LuChevronRight className="size-2.5 shrink-0 opacity-40" />
						)}
						<span
							className={
								i === parts.length - 1
									? "text-foreground/70 font-medium"
									: ""
							}
						>
							{part}
						</span>
					</span>
				))}
			</div>
			{/* Content */}
			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
				{loading ? (
					<div className="text-xs text-muted-foreground/40">
						Loading…
					</div>
				) : content ? (
					<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/75">
						{isSkillMd ? stripFrontmatter(content) : content}
					</pre>
				) : (
					<div className="text-xs text-muted-foreground/40">
						Could not read file.
					</div>
				)}
			</div>
		</div>
	);
}

function SkillViewer({ skill }: { skill: SkillInfo | null }) {
	const [selectedPath, setSelectedPath] = useState<string | null>(null);

	// Reset to SKILL.md when skill changes
	useEffect(() => {
		setSelectedPath(skill ? skill.path : null);
	}, [skill?.path]);

	if (!skill) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground/35 select-none">
				Select a skill to view its content
			</div>
		);
	}

	const rootDir =
		skill.kind === "skill"
			? skill.path.replace(/\/SKILL\.md$/, "")
			: skill.path;
	const hasFiles = skill.files.length > 1; // more than just SKILL.md

	return (
		<div className="flex h-full flex-col min-h-0">
			{/* Skill header */}
			<div className="shrink-0 border-b border-white/8 px-4 py-3">
				<div className="text-xs font-semibold leading-snug">
					{skill.name}
				</div>
				{skill.description && (
					<div className="mt-0.5 text-xs text-muted-foreground/60 leading-snug line-clamp-2">
						{skill.description}
					</div>
				)}
				<div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/40">
					<span className="flex items-center gap-1">
						<LuPackage className="size-2.5" />
						{skill.source}
					</span>
					{skill.version && <span>v{skill.version}</span>}
					{hasFiles && <span>{skill.files.length} files</span>}
				</div>
			</div>

			{/* Body: file tree (if multi-file) + content */}
			<div className="flex flex-1 min-h-0">
				{hasFiles && (
					<div className="w-[180px] shrink-0 border-r border-white/8 overflow-y-auto">
						<SkillFileTree
							files={skill.files}
							rootDir={rootDir}
							selectedPath={selectedPath ?? skill.path}
							onSelect={setSelectedPath}
						/>
					</div>
				)}
				<div className="flex flex-1 min-h-0 flex-col">
					<FileContent
						path={selectedPath ?? skill.path}
						rootDir={rootDir}
						isSkillMd={(selectedPath ?? skill.path) === skill.path}
					/>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Global tab (skills or commands)
// ---------------------------------------------------------------------------

function GlobalTab({ kind }: { kind: "skill" | "command" }) {
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<SkillInfo | null>(null);

	useEffect(() => {
		setAll([]);
		setSelected(null);
		setLoading(true);
		invoke<SkillInfo[]>("list_global_skills")
			.then(setAll)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	const items = all.filter((s) => s.kind === kind);
	const filtered = query.trim()
		? items.filter(
				(s) =>
					s.name.toLowerCase().includes(query.toLowerCase()) ||
					s.description.toLowerCase().includes(query.toLowerCase()) ||
					s.source.toLowerCase().includes(query.toLowerCase()),
			)
		: items;

	const label = kind === "skill" ? "skills" : "commands";

	return (
		<div className="flex flex-1 min-h-0 gap-0">
			<div className="flex w-[240px] shrink-0 flex-col border-r border-white/8">
				<div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
					<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={`Filter ${label}…`}
						className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
					/>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto p-1">
					{loading && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							Loading…
						</div>
					)}
					{!loading && filtered.length === 0 && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							{query ? "No matches" : `No global ${label}`}
						</div>
					)}
					{filtered.map((item) => (
						<SkillItem
							key={item.path}
							skill={item}
							selected={selected?.path === item.path}
							onClick={() => setSelected(item)}
						/>
					))}
				</div>
			</div>
			<div className="flex flex-1 min-h-0 flex-col">
				<SkillViewer skill={selected} />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Project picker (shared between Skills and Commands project tabs)
// ---------------------------------------------------------------------------

function ProjectPicker({
	selected,
	onSelect,
}: {
	selected: ClaudeProject | null;
	onSelect: (p: ClaudeProject) => void;
}) {
	const [projects, setProjects] = useState<ClaudeProject[]>([]);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		invoke<ClaudeProject[]>("list_claude_projects")
			.then(setProjects)
			.catch(console.error);
	}, []);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const filtered = query.trim()
		? projects.filter(
				(p) =>
					p.display_name
						.toLowerCase()
						.includes(query.toLowerCase()) ||
					p.path.toLowerCase().includes(query.toLowerCase()),
			)
		: projects;

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex w-full cursor-pointer items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/8 transition-colors"
			>
				<LuFolder className="size-3 shrink-0 text-muted-foreground/50" />
				<span className="flex-1 text-left truncate">
					{selected ? (
						<>
							<span className="text-foreground/80">
								{selected.display_name}
							</span>
							<span className="ml-1.5 text-muted-foreground/40 font-mono text-[10px]">
								{selected.path}
							</span>
						</>
					) : (
						<span className="text-muted-foreground/40">
							Select a project…
						</span>
					)}
				</span>
			</button>
			{open && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-white/10 bg-popover shadow-xl">
					<div className="flex items-center gap-2 border-b border-white/8 px-2.5 py-1.5">
						<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
						<input
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search projects…"
							className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
						/>
					</div>
					<div className="max-h-[200px] overflow-y-auto p-1">
						{filtered.length === 0 && (
							<div className="py-3 text-center text-xs text-muted-foreground/40">
								No projects found
							</div>
						)}
						{filtered.map((p) => (
							<button
								key={p.key}
								type="button"
								onClick={() => {
									onSelect(p);
									setOpen(false);
									setQuery("");
								}}
								className="flex w-full cursor-pointer items-start gap-2 rounded-sm px-2.5 py-1.5 text-left hover:bg-white/8 transition-colors"
							>
								<LuFolder className="mt-0.5 size-3 shrink-0 text-muted-foreground/40" />
								<div>
									<div className="text-xs font-medium leading-snug">
										{p.display_name}
									</div>
									<div className="text-[10px] font-mono text-muted-foreground/40 leading-snug">
										{p.path}
									</div>
								</div>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Project tab (skills or commands)
// ---------------------------------------------------------------------------

function ProjectTab({ kind }: { kind: "skill" | "command" }) {
	const [selectedProject, setSelectedProject] =
		useState<ClaudeProject | null>(null);
	const [all, setAll] = useState<SkillInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<SkillInfo | null>(null);

	useEffect(() => {
		if (!selectedProject) return;
		setLoading(true);
		setSelected(null);
		invoke<SkillInfo[]>("list_project_skills", {
			projectPath: selectedProject.path,
		})
			.then(setAll)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [selectedProject?.path]);

	const items = all.filter((s) => s.kind === kind);
	const filtered = query.trim()
		? items.filter(
				(s) =>
					s.name.toLowerCase().includes(query.toLowerCase()) ||
					s.description.toLowerCase().includes(query.toLowerCase()),
			)
		: items;

	const label = kind === "skill" ? "skills" : "commands";

	return (
		<div className="flex flex-1 min-h-0 flex-col">
			<div className="shrink-0 border-b border-white/8 px-3 py-2">
				<ProjectPicker
					selected={selectedProject}
					onSelect={(p) => {
						setSelectedProject(p);
						setAll([]);
						setSelected(null);
					}}
				/>
			</div>
			{selectedProject ? (
				<div className="flex flex-1 min-h-0 gap-0">
					<div className="flex w-[240px] shrink-0 flex-col border-r border-white/8">
						<div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
							<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={`Filter ${label}…`}
								className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
							/>
						</div>
						<div className="flex-1 min-h-0 overflow-y-auto p-1">
							{loading && (
								<div className="py-6 text-center text-xs text-muted-foreground/40">
									Loading…
								</div>
							)}
							{!loading && filtered.length === 0 && (
								<div className="py-6 text-center text-xs text-muted-foreground/40">
									{query
										? "No matches"
										: `No ${label} in this project`}
								</div>
							)}
							{filtered.map((item) => (
								<SkillItem
									key={item.path}
									skill={item}
									selected={selected?.path === item.path}
									onClick={() => setSelected(item)}
								/>
							))}
						</div>
					</div>
					<div className="flex flex-1 min-h-0 flex-col">
						<SkillViewer skill={selected} />
					</div>
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/35 select-none">
					Pick a project to see its {label}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main sheet
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hooks UI
// ---------------------------------------------------------------------------

/** Colour + label for the handler type badge. */
function HandlerTypeBadge({ type: t }: { type: string }) {
	const cfg =
		t === "http"
			? { icon: LuGlobe, label: "http", cls: "text-sky-400/80" }
			: t === "prompt"
				? {
						icon: LuMessageSquare,
						label: "prompt",
						cls: "text-violet-400/80",
					}
				: { icon: LuZap, label: "cmd", cls: "text-amber-400/80" };
	const Icon = cfg.icon;
	return (
		<span
			className={`flex items-center gap-0.5 font-mono text-[10px] ${cfg.cls}`}
		>
			<Icon className="size-2.5 shrink-0" />
			{cfg.label}
		</span>
	);
}

function HookItem({
	hook,
	selected,
	onClick,
}: {
	hook: HookInfo;
	selected: boolean;
	onClick: () => void;
}) {
	const display = hook.command ?? hook.url ?? "—";
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full cursor-pointer text-left px-3 py-2 rounded-sm transition-colors ${
				selected
					? "bg-accent text-accent-foreground"
					: "hover:bg-white/5 text-foreground/80"
			} ${hook.disabled ? "opacity-40" : ""}`}
		>
			<div className="flex items-center gap-2">
				<span className="text-xs font-medium font-mono leading-snug truncate">
					{hook.event}
				</span>
				{hook.matcher && (
					<span className="shrink-0 rounded px-1 py-px text-[10px] font-mono bg-white/8 text-muted-foreground/70">
						{hook.matcher}
					</span>
				)}
				<HandlerTypeBadge type={hook.handler_type} />
			</div>
			<div className="mt-0.5 text-[10px] font-mono text-muted-foreground/55 truncate leading-snug">
				{display}
			</div>
			<div className="mt-0.5 text-[10px] text-muted-foreground/35 truncate leading-snug">
				{hook.source}
			</div>
		</button>
	);
}

/** Key-value row used in the hook detail panel. */
function DetailRow({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex min-w-0 gap-3 py-0.5">
			<span className="w-24 shrink-0 text-[10px] text-muted-foreground/45 uppercase tracking-wide leading-relaxed">
				{label}
			</span>
			<span
				className={`min-w-0 flex-1 break-all text-xs leading-relaxed text-foreground/75 ${mono ? "font-mono" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}

function HookViewer({ hook }: { hook: HookInfo | null }) {
	if (!hook) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground/35 select-none">
				Select a hook to view details
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col min-h-0 overflow-y-auto px-4 py-3">
			{/* Title row */}
			<div className="mb-3 flex items-center gap-2 flex-wrap">
				<span className="text-xs font-semibold font-mono">
					{hook.event}
				</span>
				{hook.matcher && (
					<span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-white/8 text-muted-foreground/70">
						{hook.matcher}
					</span>
				)}
				<HandlerTypeBadge type={hook.handler_type} />
				{hook.disabled && (
					<span className="rounded px-1.5 py-0.5 text-[10px] bg-red-500/15 text-red-400/80">
						disabled
					</span>
				)}
			</div>

			{/* Detail rows */}
			<div className="flex flex-col divide-y divide-white/5">
				{hook.command && (
					<DetailRow label="Command" value={hook.command} mono />
				)}
				{hook.url && <DetailRow label="URL" value={hook.url} mono />}
				{hook.matcher ? (
					<DetailRow label="Matcher" value={hook.matcher} mono />
				) : (
					<DetailRow label="Matcher" value="(all)" />
				)}
				<DetailRow label="Type" value={hook.handler_type} />
				{hook.timeout != null && (
					<DetailRow label="Timeout" value={`${hook.timeout}s`} />
				)}
				<DetailRow
					label="Background"
					value={hook.run_in_background ? "yes" : "no"}
				/>
				<DetailRow label="Source" value={hook.source} mono />
			</div>
		</div>
	);
}

function HooksGlobalTab() {
	const [hooks, setHooks] = useState<HookInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<HookInfo | null>(null);

	useEffect(() => {
		setLoading(true);
		invoke<HookInfo[]>("list_global_hooks")
			.then(setHooks)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, []);

	const filtered = query.trim()
		? hooks.filter(
				(h) =>
					h.event.toLowerCase().includes(query.toLowerCase()) ||
					(h.command ?? "")
						.toLowerCase()
						.includes(query.toLowerCase()) ||
					(h.url ?? "").toLowerCase().includes(query.toLowerCase()) ||
					h.matcher.toLowerCase().includes(query.toLowerCase()),
			)
		: hooks;

	return (
		<div className="flex flex-1 min-h-0 gap-0">
			<div className="flex w-[240px] shrink-0 flex-col border-r border-white/8">
				<div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
					<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Filter hooks…"
						className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
					/>
				</div>
				<div className="flex-1 min-h-0 overflow-y-auto p-1">
					{loading && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							Loading…
						</div>
					)}
					{!loading && filtered.length === 0 && (
						<div className="py-6 text-center text-xs text-muted-foreground/40">
							{query ? "No matches" : "No global hooks"}
						</div>
					)}
					{filtered.map((hook, i) => (
						<HookItem
							key={`${hook.event}-${hook.matcher}-${i}`}
							hook={hook}
							selected={selected === hook}
							onClick={() => setSelected(hook)}
						/>
					))}
				</div>
			</div>
			<div className="flex flex-1 min-h-0 flex-col">
				<HookViewer hook={selected} />
			</div>
		</div>
	);
}

function HooksProjectTab() {
	const [selectedProject, setSelectedProject] =
		useState<ClaudeProject | null>(null);
	const [hooks, setHooks] = useState<HookInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<HookInfo | null>(null);

	useEffect(() => {
		if (!selectedProject) return;
		setLoading(true);
		setSelected(null);
		invoke<HookInfo[]>("list_project_hooks", {
			projectPath: selectedProject.path,
		})
			.then(setHooks)
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [selectedProject?.path]);

	const filtered = query.trim()
		? hooks.filter(
				(h) =>
					h.event.toLowerCase().includes(query.toLowerCase()) ||
					(h.command ?? "")
						.toLowerCase()
						.includes(query.toLowerCase()) ||
					(h.url ?? "").toLowerCase().includes(query.toLowerCase()) ||
					h.matcher.toLowerCase().includes(query.toLowerCase()),
			)
		: hooks;

	return (
		<div className="flex flex-1 min-h-0 flex-col">
			<div className="shrink-0 border-b border-white/8 px-3 py-2">
				<ProjectPicker
					selected={selectedProject}
					onSelect={(p) => {
						setSelectedProject(p);
						setHooks([]);
						setSelected(null);
					}}
				/>
			</div>
			{selectedProject ? (
				<div className="flex flex-1 min-h-0 gap-0">
					<div className="flex w-[240px] shrink-0 flex-col border-r border-white/8">
						<div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
							<LuSearch className="size-3 shrink-0 text-muted-foreground/40" />
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Filter hooks…"
								className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/35"
							/>
						</div>
						<div className="flex-1 min-h-0 overflow-y-auto p-1">
							{loading && (
								<div className="py-6 text-center text-xs text-muted-foreground/40">
									Loading…
								</div>
							)}
							{!loading && filtered.length === 0 && (
								<div className="py-6 text-center text-xs text-muted-foreground/40">
									{query
										? "No matches"
										: "No hooks in this project"}
								</div>
							)}
							{filtered.map((hook, i) => (
								<HookItem
									key={`${hook.event}-${hook.matcher}-${i}`}
									hook={hook}
									selected={selected === hook}
									onClick={() => setSelected(hook)}
								/>
							))}
						</div>
					</div>
					<div className="flex flex-1 min-h-0 flex-col">
						<HookViewer hook={selected} />
					</div>
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/35 select-none">
					Pick a project to see its hooks
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main sheet
// ---------------------------------------------------------------------------

type TopTab = "skills" | "commands" | "hooks";
type Scope = "global" | "project";

export function ClaudeSettingsSheet() {
	const [tab, setTab] = useState<TopTab>("skills");
	const [scope, setScope] = useState<Scope>("global");

	return (
		<Sheet>
			<SheetTrigger
				className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors rounded-sm hover:bg-white/6"
				title="Claude settings"
			>
				<LuBrain className="size-3 shrink-0" aria-hidden />
				<span>Config</span>
			</SheetTrigger>

			<SheetContent
				side="right"
				className="mt-8 flex flex-col gap-0 p-0 border-l-0"
			>
				{/* Header */}
				<div className="shrink-0 flex items-center gap-2 border-b border-white/8 px-4 py-3">
					<LuBrain className="size-4 shrink-0 text-muted-foreground/60" />
					<SheetTitle className="text-sm font-semibold">
						Claude Settings
					</SheetTitle>
				</div>

				{/* Top tabs: Skills | Commands | Hooks */}
				<div className="shrink-0 flex items-center gap-0 border-b border-white/8 px-4">
					{(["skills", "commands", "hooks"] as TopTab[]).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={`mr-4 cursor-pointer capitalize pb-2 pt-2.5 text-xs font-medium transition-colors border-b-2 ${
								tab === t
									? "border-foreground/80 text-foreground/80"
									: "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
							}`}
						>
							{t}
						</button>
					))}
				</div>

				{/* Scope selector: Global | Project */}
				<div className="shrink-0 flex items-center gap-1 border-b border-white/8 bg-white/2 px-3 py-1.5">
					{(["global", "project"] as Scope[]).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setScope(s)}
							className={`cursor-pointer rounded-sm px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
								scope === s
									? "bg-white/10 text-foreground/90"
									: "text-muted-foreground/50 hover:text-muted-foreground"
							}`}
						>
							{s}
						</button>
					))}
				</div>

				{/* Content */}
				<div className="flex flex-1 min-h-0 flex-col">
					{tab === "hooks" ? (
						scope === "global" ? (
							<HooksGlobalTab />
						) : (
							<HooksProjectTab />
						)
					) : tab === "skills" ? (
						scope === "global" ? (
							<GlobalTab kind="skill" />
						) : (
							<ProjectTab kind="skill" />
						)
					) : scope === "global" ? (
						<GlobalTab kind="command" />
					) : (
						<ProjectTab kind="command" />
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
