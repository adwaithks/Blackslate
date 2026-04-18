import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IoClose } from "react-icons/io5";
import { TbGitCommit } from "react-icons/tb";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function useSpinner(active: boolean): string {
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		if (!active) { setFrame(0); return; }
		const id = setInterval(
			() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
			80,
		);
		return () => clearInterval(id);
	}, [active]);
	return SPINNER_FRAMES[frame]!;
}

type Phase = "idle" | "working" | "passphrase";

export function TitlebarCommitButton({ cwd }: { cwd: string }) {
	const [phase, setPhase] = useState<Phase>("idle");
	const [statusText, setStatusText] = useState("Commit & Push");
	const [passphrase, setPassphrase] = useState("");
	const [passphraseHint, setPassphraseHint] = useState("");
	const [passphraseError, setPassphraseError] = useState(false);
	const [needsUpstream, setNeedsUpstream] = useState(false);
	const passphraseInputRef = useRef<HTMLInputElement>(null);
	const spinnerChar = useSpinner(phase === "working");

	useEffect(() => {
		if (phase === "passphrase") {
			setTimeout(() => passphraseInputRef.current?.focus(), 30);
		}
	}, [phase]);

	async function doPush(pass?: string): Promise<boolean> {
		setStatusText("Pushing…");
		try {
			const result = await invoke<{
				success: boolean;
				needsPassphrase: boolean;
				passphraseHint: string;
				needsUpstream: boolean;
			}>("git_push", {
				cwd,
				passphrase: pass ?? null,
				setUpstream: needsUpstream || undefined,
			});

			if (result.success) {
				setPhase("idle");
				setStatusText("Pushed!");
				setTimeout(() => setStatusText("Commit & Push"), 2000);
				return true;
			}

			if (result.needsPassphrase) {
				setNeedsUpstream(result.needsUpstream);
				setPassphraseHint(result.passphraseHint);
				// Wrong passphrase: clear the field so the user knows to re-enter.
				if (pass !== undefined) {
					setPassphraseError(true);
					setPassphrase("");
				} else {
					setPassphraseError(false);
				}
				setPhase("passphrase");
				return false;
			}
			return false;
		} catch (err) {
			toast.error("Push failed", { description: String(err) });
			setPhase("idle");
			setStatusText("Commit & Push");
			return false;
		}
	}

	async function handleClick() {
		if (phase !== "idle") return;

		// Check for staged changes before doing anything.
		const status = await invoke<{ staged: unknown[]; unstaged: unknown[] } | null>(
			"get_git_status",
			{ cwd },
		);
		const hasStaged = (status?.staged.length ?? 0) > 0;
		const hasUnstaged = (status?.unstaged.length ?? 0) > 0;

		if (!hasStaged) {
			toast("No staged changes", {
				description: hasUnstaged
					? "Stage your changes first, then commit."
					: "Nothing to commit in this repository.",
				...(hasUnstaged && {
					action: {
						label: "Stage all",
						onClick: () =>
							invoke("stage_all", { cwd })
								.then(() => toast.success("All changes staged"))
								.catch((err) => toastError("Failed to stage changes", err)),
					},
				}),
			});
			return;
		}

		setPhase("working");
		setStatusText("Generating…");

		// Generate commit message
		let message = "";
		try {
			const result = await invoke<{ title: string; description: string }>(
				"git_generate_commit_message",
				{ cwd },
			);
			message = result.description.trim()
				? `${result.title}\n\n${result.description}`
				: result.title;
		} catch (err) {
			toast.error("Could not generate commit message", {
				description: String(err),
			});
			setPhase("idle");
			setStatusText("Commit & Push");
			return;
		}

		// Commit
		setStatusText("Committing…");
		try {
			await invoke("git_commit", { cwd, message });
		} catch (err) {
			toast.error("Commit failed", { description: String(err) });
			setPhase("idle");
			setStatusText("Commit & Push");
			return;
		}

		// Push
		const pushed = await doPush();
		if (pushed) setPhase("idle");
	}

	async function handlePassphraseSubmit() {
		if (!passphrase.trim()) return;
		setPhase("working");
		const pushed = await doPush(passphrase);
		if (pushed) {
			setPassphrase("");
			setPhase("idle");
		}
	}

	return (
		<div className="relative flex items-center">
			<button
				type="button"
				onClick={handleClick}
				disabled={phase === "working"}
				title="Commit & Push staged changes"
				aria-label="Commit & Push staged changes"
				className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
			>
				{phase === "working" ? (
					<span
						className="w-4 shrink-0 text-center font-mono text-xs leading-none"
						aria-hidden
					>
						{spinnerChar}
					</span>
				) : (
					<TbGitCommit className="size-4 shrink-0" aria-hidden />
				)}
				<span className="text-xs">{statusText}</span>
			</button>

			{/* Passphrase dialog — centered overlay, same style as other dialogs */}
			{phase === "passphrase" && (
				<>
					<div className="fixed inset-0 z-50 bg-black/40" />
					<div className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
						<div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
							<span className="text-xs font-medium tracking-wide text-muted-foreground">
								{passphraseError ? "Incorrect passphrase — try again" : "Passphrase required"}
							</span>
							<button
								type="button"
								className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground"
								onClick={() => { setPassphrase(""); setPassphraseError(false); setNeedsUpstream(false); setPhase("idle"); }}
							>
								<IoClose className="size-4" />
							</button>
						</div>
						<div className="flex flex-col gap-5 p-4">
							{passphraseHint && (
								<p className="text-xs text-muted-foreground">{passphraseHint}</p>
							)}
							<Input
								ref={passphraseInputRef}
								type="password"
								value={passphrase}
								onChange={(e) => setPassphrase(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handlePassphraseSubmit();
									if (e.key === "Escape") { setPassphrase(""); setPassphraseError(false); setNeedsUpstream(false); setPhase("idle"); }
								}}
								placeholder="Enter passphrase…"
								className="h-9 border-border bg-input/30 text-xs placeholder:text-muted-foreground/50"
							/>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
									onClick={() => { setPassphrase(""); setPassphraseError(false); setNeedsUpstream(false); setPhase("idle"); }}
								>
									Cancel
								</button>
								<Button
									type="button"
									size="sm"
									className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
									onClick={handlePassphraseSubmit}
									disabled={!passphrase.trim()}
								>
									Push
								</Button>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
