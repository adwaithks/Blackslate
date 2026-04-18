import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IoClose } from "react-icons/io5";
import { TbGitBranch, TbGitCommit, TbGitFork } from "react-icons/tb";
import { LuEye, LuEyeOff, LuFolder } from "react-icons/lu";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function useSpinner(active: boolean): string {
	const [frame, setFrame] = useState(0);
	useEffect(() => {
		if (!active) {
			setFrame(0);
			return;
		}
		const id = setInterval(
			() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length),
			80,
		);
		return () => clearInterval(id);
	}, [active]);
	return SPINNER_FRAMES[frame]!;
}

type Phase = "idle" | "compose" | "working" | "passphrase" | "error";

function buildCommitMessage(title: string, description: string): string {
	const t = title.trim();
	const d = description.trim();
	return d ? `${t}\n\n${d}` : t;
}

export function TitlebarCommitButton({
	cwd,
	branch,
	repoName,
	isWorktree,
}: {
	cwd: string;
	branch?: string;
	repoName?: string;
	isWorktree?: boolean;
}) {
	const [phase, setPhase] = useState<Phase>("idle");
	const [workLabel, setWorkLabel] = useState("");
	const [commitTitle, setCommitTitle] = useState("");
	const [commitDescription, setCommitDescription] = useState("");
	const [generating, setGenerating] = useState(false);
	const [errorTitle, setErrorTitle] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [passphrase, setPassphrase] = useState("");
	const [passphraseHint, setPassphraseHint] = useState("");
	const [passphraseError, setPassphraseError] = useState(false);
	const [showPassphrase, setShowPassphrase] = useState(false);
	const [needsUpstream, setNeedsUpstream] = useState(false);
	const passphraseInputRef = useRef<HTMLInputElement>(null);
	const titleInputRef = useRef<HTMLInputElement>(null);
	const spinnerChar = useSpinner(phase === "working");
	const abortRef = useRef(false);
	const prevCwdRef = useRef<string | null>(null);

	useEffect(() => {
		if (phase === "passphrase") {
			setTimeout(() => passphraseInputRef.current?.focus(), 30);
		}
	}, [phase]);

	useEffect(() => {
		if (phase === "compose") {
			setTimeout(() => titleInputRef.current?.focus(), 30);
		}
	}, [phase]);

	// Terminal cwd changed (e.g. `cd`) → drop draft commit message
	useEffect(() => {
		if (prevCwdRef.current === null) {
			prevCwdRef.current = cwd;
			return;
		}
		if (prevCwdRef.current !== cwd) {
			prevCwdRef.current = cwd;
			if (phase === "compose") {
				setPhase("idle");
				setCommitTitle("");
				setCommitDescription("");
				setGenerating(false);
			}
		}
	}, [cwd, phase]);

	function abort() {
		abortRef.current = true;
		setPhase("idle");
		setWorkLabel("");
		setCommitTitle("");
		setCommitDescription("");
		setGenerating(false);
		setPassphrase("");
		setPassphraseError(false);
		setShowPassphrase(false);
		setNeedsUpstream(false);
	}

	function showError(title: string, message: string) {
		setErrorTitle(title);
		setErrorMessage(message);
		setPhase("error");
		setWorkLabel("");
	}

	async function doPush(pass?: string): Promise<boolean> {
		setWorkLabel("Pushing…");
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

			if (abortRef.current) {
				setPhase("idle");
				setWorkLabel("");
				return false;
			}

			if (result.success) {
				setPhase("idle");
				setWorkLabel("");
				setCommitTitle("");
				setCommitDescription("");
				toast.success("Pushed");
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
				setWorkLabel("");
				return false;
			}
			showError(
				"Push failed",
				"Git push did not complete. Check the remote and try again from the command line if needed.",
			);
			return false;
		} catch (err) {
			if (abortRef.current) {
				setPhase("idle");
				setWorkLabel("");
				return false;
			}
			showError("Push failed", String(err));
			return false;
		}
	}

	async function runCommitAndPushFromCompose() {
		const message = buildCommitMessage(commitTitle, commitDescription);
		if (!message) {
			toast("Add a commit title", { description: "The subject line cannot be empty." });
			return;
		}

		abortRef.current = false;
		setPhase("working");
		setWorkLabel("Committing…");

		try {
			await invoke("git_commit", { cwd, message });
			if (abortRef.current) return;
		} catch (err) {
			if (abortRef.current) return;
			showError("Commit failed", String(err));
			return;
		}

		await doPush();
	}

	async function handleGenerateAi() {
		setGenerating(true);
		try {
			const result = await invoke<{ title: string; description: string }>(
				"git_generate_commit_message",
				{ cwd },
			);
			setCommitTitle(result.title);
			setCommitDescription(result.description ?? "");
			toast.success("Filled from AI");
		} catch (err) {
			toastError("Could not generate commit message", err);
		} finally {
			setGenerating(false);
		}
	}

	async function handleMainButtonClick() {
		if (phase === "working") {
			abort();
			return;
		}
		if (phase === "compose") {
			setPhase("idle");
			setCommitTitle("");
			setCommitDescription("");
			return;
		}
		if (phase !== "idle") return;

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

		setCommitTitle("");
		setCommitDescription("");
		setPhase("compose");
	}

	async function handlePassphraseSubmit() {
		if (!passphrase.trim()) return;
		abortRef.current = false;
		setPhase("working");
		setWorkLabel("Pushing…");
		await doPush(passphrase);
	}

	const mainLabel =
		phase === "working" ? "Cancel" : phase === "compose" ? "Close" : "Commit & Push";

	return (
		<div className="relative flex items-center">
			<button
				type="button"
				onClick={handleMainButtonClick}
				title={
					phase === "working"
						? "Cancel"
						: phase === "compose"
							? "Close commit dialog"
							: "Commit & Push staged changes"
				}
				aria-label={mainLabel}
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
				<span className="text-xs">{mainLabel}</span>
			</button>

			{(phase === "compose" || (phase === "working" && workLabel)) && (
				<>
					<div className="fixed inset-0 z-50 bg-black/40" />
					<div className="fixed left-1/2 top-1/2 z-50 flex w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
						<div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
							<span className="text-xs font-medium tracking-wide text-muted-foreground">
								{phase === "working" ? workLabel : "Commit & Push"}
							</span>
							<button
								type="button"
								className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground disabled:opacity-40"
								onClick={() => {
									if (phase === "working") return;
									setPhase("idle");
									setCommitTitle("");
									setCommitDescription("");
									setGenerating(false);
								}}
								disabled={phase === "working"}
								aria-label="Close"
							>
								<IoClose className="size-4" />
							</button>
						</div>
						{phase === "compose" ? (
							<div className="flex flex-col gap-4 p-4">
								{(repoName || branch) && (
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										{repoName && (
											<span className="flex items-center gap-1">
												{isWorktree ? (
													<TbGitFork className="size-3.5 shrink-0" aria-hidden />
												) : (
													<LuFolder className="size-3.5 shrink-0" aria-hidden />
												)}
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
								<div className="flex flex-col gap-1.5">
									<label className="text-[11px] font-medium text-muted-foreground">
										Title
									</label>
									<Input
										ref={titleInputRef}
										value={commitTitle}
										onChange={(e) => setCommitTitle(e.target.value)}
										placeholder="Short summary (required)"
										className="h-9 border-border bg-input/30 text-xs placeholder:text-muted-foreground/50"
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<label className="text-[11px] font-medium text-muted-foreground">
										Description
									</label>
									<Textarea
										value={commitDescription}
										onChange={(e) => setCommitDescription(e.target.value)}
										placeholder="Optional body"
										rows={4}
										className="resize-y border-border bg-input/30 text-xs placeholder:text-muted-foreground/50"
									/>
								</div>
								<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										className="mr-auto text-xs"
										onClick={handleGenerateAi}
										disabled={generating}
									>
										{generating ? "Generating…" : "Generate with AI"}
									</Button>
									<button
										type="button"
										className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
										onClick={() => {
											setPhase("idle");
											setCommitTitle("");
											setCommitDescription("");
										}}
									>
										Cancel
									</button>
									<Button
										type="button"
										size="sm"
										className="bg-primary text-primary-foreground hover:bg-primary/90"
										onClick={runCommitAndPushFromCompose}
										disabled={!commitTitle.trim()}
									>
										Commit & Push
									</Button>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-3 px-4 py-8">
								<span
									className="font-mono text-sm"
									aria-hidden
								>
									{spinnerChar}
								</span>
								<span className="text-sm text-muted-foreground">{workLabel}</span>
							</div>
						)}
					</div>
				</>
			)}

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
											{isWorktree ? (
												<TbGitFork className="size-3.5 shrink-0" aria-hidden />
											) : (
												<LuFolder className="size-3.5 shrink-0" aria-hidden />
											)}
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
									{showPassphrase ? (
										<LuEyeOff className="size-3.5" aria-hidden />
									) : (
										<LuEye className="size-3.5" aria-hidden />
									)}
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
											{isWorktree ? (
												<TbGitFork className="size-3.5 shrink-0" aria-hidden />
											) : (
												<LuFolder className="size-3.5 shrink-0" aria-hidden />
											)}
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
