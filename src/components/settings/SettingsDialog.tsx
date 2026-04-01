import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";
import {
	useSettingsStore,
	TERMINAL_THEME_OPTIONS,
	SIDEBAR_COLOR_OPTIONS,
	type TerminalThemeId,
	type SidebarColorId,
} from "@/store/settings";

// ─── Mini terminal preview strip ──────────────────────────────────────────────
// Mimics a few lines of coloured terminal output to give a sense of the palette.
function ThemePreview({ bg, fg, accent }: { bg: string; fg: string; accent: string }) {
	return (
		<span
			className="flex h-10 w-20 shrink-0 flex-col justify-center gap-[3px] overflow-hidden rounded px-2"
			style={{ background: bg }}
		>
			{/* prompt line */}
			<span className="flex items-center gap-1">
				<span className="h-[5px] w-[5px] rounded-full" style={{ background: accent }} />
				<span className="h-[3px] w-8 rounded-full opacity-70" style={{ background: fg }} />
			</span>
			{/* output line */}
			<span className="flex items-center gap-1 pl-3">
				<span className="h-[3px] w-5 rounded-full opacity-45" style={{ background: fg }} />
				<span className="h-[3px] w-3 rounded-full opacity-25" style={{ background: fg }} />
			</span>
			{/* accent line — e.g. a directory */}
			<span className="flex items-center gap-1 pl-3">
				<span className="h-[3px] w-6 rounded-full opacity-80" style={{ background: accent }} />
			</span>
		</span>
	);
}

// ─── Sidebar swatch ───────────────────────────────────────────────────────────
function SidebarSwatch({ color }: { color: string }) {
	return (
		<span
			className="h-6 w-6 shrink-0 rounded ring-1 ring-inset ring-border"
			style={{ background: color }}
		/>
	);
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50 pb-0.5">
			{children}
		</p>
	);
}

// ─── Main dialog ─────────────────────────────────────────────────────────────
export function SettingsDialog() {
	const [open, setOpen] = useState(false);

	const { terminalTheme, sidebarColor, setTerminalTheme, setSidebarColor } =
		useSettingsStore();

	useEffect(() => {
		const unlisten = listen("blackslate://open-settings", () => setOpen(true));
		return () => { unlisten.then((fn) => fn()); };
	}, []);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Portal>
				{/* Backdrop — very subtle, keep terminal visible behind */}
				<Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />

				<Dialog.Popup
					className={cn(
						// Position
						"fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
					// Size
					"w-[460px]",
						// Surface — match app surfaces
						"bg-background border border-border rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.8)]",
						// Layout
						"flex flex-col overflow-hidden",
						// Animation
						"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
						"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
						"duration-150",
					)}
				>
					{/* Title bar strip — matches the app titlebar height */}
					<div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4 bg-background">
						<Dialog.Title className="text-xs font-medium text-muted-foreground tracking-wide">
							Settings
						</Dialog.Title>
					<Dialog.Close
						className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/60 hover:text-foreground/80 transition-colors"
						aria-label="Close"
					>
							<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
								<path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
							</svg>
						</Dialog.Close>
					</div>

					{/* Body */}
					<div className="flex flex-col gap-5 p-4">

						{/* ── Terminal Theme ── */}
						<section className="flex flex-col gap-2">
							<SectionLabel>Terminal Theme</SectionLabel>
						<div className="grid grid-cols-2 gap-1">
							{TERMINAL_THEME_OPTIONS.map((opt) => {
								const active = terminalTheme === opt.id;
								return (
									<button
										key={opt.id}
										type="button"
										onClick={() => setTerminalTheme(opt.id as TerminalThemeId)}
										className={cn(
											"flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
											active
												? "bg-muted/50"
												: "bg-transparent hover:bg-muted/30",
										)}
									>
										<ThemePreview {...opt.preview} />
										<span
											className={cn(
												"flex-1 text-xs font-medium",
												active
													? "text-foreground"
													: "text-muted-foreground/70",
											)}
										>
											{opt.label}
										</span>
										<span
											className={cn(
												"size-1.5 shrink-0 rounded-full transition-colors",
												active
													? "bg-foreground/45"
													: "bg-transparent",
											)}
										/>
									</button>
								);
							})}
						</div>
						</section>

						{/* Divider */}
						<div className="h-px bg-border/30" />

						{/* ── Sidebar Color ── */}
						<section className="flex flex-col gap-2">
							<SectionLabel>Sidebar Color</SectionLabel>
							<div className="grid grid-cols-2 gap-1">
								{SIDEBAR_COLOR_OPTIONS.map((opt) => {
									const active = sidebarColor === opt.id;
									return (
										<button
											key={opt.id}
											type="button"
											onClick={() => setSidebarColor(opt.id as SidebarColorId)}
									className={cn(
											"flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
											active
												? "bg-muted/50"
												: "bg-transparent hover:bg-muted/30",
										)}
									>
										<SidebarSwatch color={opt.value} />
											<span
												className={cn(
													"text-xs font-medium",
													active
													? "text-foreground"
													: "text-muted-foreground/70",
												)}
											>
												{opt.label}
											</span>
											<span
												className={cn(
													"ml-auto size-1.5 shrink-0 rounded-full transition-colors",
													active
													? "bg-foreground/45"
													: "bg-transparent",
												)}
											/>
										</button>
									);
								})}
							</div>
						</section>

					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
