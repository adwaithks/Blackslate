import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IoClose } from "react-icons/io5";
import { TbGitBranch, TbGitCommit, TbGitFork } from "react-icons/tb";
import { LuEye, LuEyeOff, LuFolder } from "react-icons/lu";
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

type Phase = "idle" | "working" | "passphrase" | "error";

export function TitlebarCommitButton({
	cwd,
	hidden,
	branch,
	repoName,
	isWorktree,
}: {
	cwd: string;
	hidden?: boolean;
	branch?: string;
	repoName?: string;
	isWorktree?: boolean;
}) {
	const [phase, setPhase] = useState<Phase>("idle");
	const [statusText, setStatusText] = useState("Commit & Push");
	const [errorTitle, setErrorTitle] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [passphrase, setPassphrase] = useState("");
	const [passphraseHint, setPassphraseHint] = useState("");
	const [passphraseError, setPassphraseError] = useState(false);
	const [showPassphrase, setShowPassphrase] = useState(false);
	const [needsUpstream, setNeedsUpstream] = useState(false);
	const passphraseInputRef = useRef<HTMLInputElement>(null);
	const spinnerChar = useSpinner(phase === "working");
	// Set to true to abandon in-flight work without showing errors.
	const abortRef = useRef(false);

	useEffect(() => {
		if (phase === "passphrase") {
			setTimeout(() => passphraseInputRef.current?.focus(), 30);
		}
	}, [phase]);

	function abort() {
		abortRef.current = true;
		setPhase("idle");
		setStatusText("Commit & Push");
		setPassphrase("");
		setPassphraseError(false);
		setShowPassphrase(false);
		setNeedsUpstream(false);
	}

	function showError(title: string, message: string) {
		setErrorTitle(title);
		setErrorMessage(message);
		setPhase("error");
		setStatusText("Commit & Push");
	}

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

			if (abortRef.current) return false;

			if (result.success) {
				setPhase("idle");
				setStatusText("Pushed!");
				setTimeout(() => setStatusText("Commit & Push"), 2000);
				return true;
			}

			if (result.needsPassphrase) {
				setNeedsUpstream(result.needsUpstream);
				setPassphraseHint(result.passphraseHint);
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
			if (abortRef.current) return false;
			showError("Push failed", String(err));
			return false;
		}
	}

	async function handleClick() {
		// While working: clicking the button cancels the operation.
		if (phase === "working") {
			abort();
			return;
		}
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

		abortRef.current = false;
		setPhase("working");
		setStatusText("Generating…");

		// Generate commit message
		let message = "";
		try {
			const result = await invoke<{ title: string; description: string }>(
				"git_generate_commit_message",
				{ cwd },
			);
			if (abortRef.current) return;
			message = result.description.trim()
				? `${result.title}\n\n${result.description}`
				: result.title;
		} catch (err) {
			if (abortRef.current) return;
			showError("Could not generate commit message", String(err));
			return;
		}

		// Commit
		setStatusText("Committing…");
		try {
			await invoke("git_commit", { cwd, message });
			if (abortRef.current) return;
		} catch (err) {
			if (abortRef.current) return;
			showError("Commit failed", String(err));
			return;
		}

		// Push
		await doPush();
	}

	async function handlePassphraseSubmit() {
		if (!passphrase.trim()) return;
		abortRef.current = false;
		setPhase("working");
		await doPush(passphrase);
	}

	// Hidden instances stay mounted so their state (phase, spinner, etc.) survives
	// terminal switches, but render nothing into the DOM.
	if (hidden) return null;

	return (
		<div className="relative flex items-center">
			<button
				type="button"
				onClick={handleClick}
				title={phase === "working" ? "Cancel" : "Commit & Push staged changes"}
				aria-label={phase === "working" ? "Cancel" : "Commit & Push staged changes"}
				className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground"
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

			{/* Passphrase dialog */}
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
								onClick={abort}
							>
								<IoClose className="size-4" />
							</button>
						</div>
						<div className="flex flex-col gap-5 p-4">
							{(repoName || branch) && (
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									{repoName && (
										<span className="flex items-center gap-1">
											{isWorktree
												? <TbGitFork className="size-3.5 shrink-0" aria-hidden />
												: <LuFolder className="size-3.5 shrink-0" aria-hidden />
											}
											{repoName}
										</span>
									)}
									{branch && (
										<span className="flex items-center gap-1">
											<TbGitBranch className="size-3.5 shrink-0" aria-hidden />
											{branch}
										</span>
									)}
								</div>
							)}
							{passphraseHint && (
								<p className="text-xs text-muted-foreground">{passphraseHint}</p>
							)}
							<div className="relative">
								<Input
									ref={passphraseInputRef}
									type={showPassphrase ? "text" : "password"}
									value={passphrase}
									onChange={(e) => setPassphrase(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handlePassphraseSubmit();
									}}
									placeholder="Enter passphrase…"
									className="h-9 border-border bg-input/30 pr-9 text-xs placeholder:text-muted-foreground/50"
								/>
								<button
									type="button"
									tabIndex={-1}
									onClick={() => setShowPassphrase((v) => !v)}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
									aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
								>
									{showPassphrase
										? <LuEyeOff className="size-3.5" aria-hidden />
										: <LuEye className="size-3.5" aria-hidden />
									}
								</button>
							</div>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
									onClick={abort}
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
			{/* Error dialog — full output for pre-commit hooks, test failures, push errors */}
			{phase === "error" && (
				<>
					<div className="fixed inset-0 z-50 bg-black/40" />
					<div className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
						<div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
							<span className="text-xs font-medium tracking-wide text-destructive">
								{errorTitle}
							</span>
							{(repoName || branch) && (
								<div className="flex items-center gap-3 ml-2 mr-auto text-xs text-muted-foreground/60">
									{repoName && (
										<span className="flex items-center gap-1">
											{isWorktree
												? <TbGitFork className="size-3.5 shrink-0" aria-hidden />
												: <LuFolder className="size-3.5 shrink-0" aria-hidden />
											}
											{repoName}
										</span>
									)}
									{branch && (
										<span className="flex items-center gap-1">
											<TbGitBranch className="size-3.5 shrink-0" aria-hidden />
											{branch}
										</span>
									)}
								</div>
							)}
							<button
								type="button"
								className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground"
								onClick={abort}
							>
								<IoClose className="size-4" />
							</button>
						</div>
						<div className="p-4">
							<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80">
								{errorMessage}
							</pre>
						</div>
						<div className="flex justify-end border-t border-border px-4 py-3">
							<button
								type="button"
								className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
								onClick={abort}
							>
								Dismiss
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
