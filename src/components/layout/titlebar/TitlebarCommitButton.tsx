import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TbGitBranch, TbGitCommit, TbGitFork } from "react-icons/tb";
import { LuEye, LuEyeOff, LuFolder, LuWandSparkles } from "react-icons/lu";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

/** Matches git panel repo header (`RepoSection` collapsible trigger row). */
function RepoBranchMeta({
	repoName,
	branch,
	isWorktree,
	className,
}: {
	repoName?: string;
	branch?: string;
	isWorktree?: boolean;
	className?: string;
}) {
	if (!repoName && !branch) return null;
	return (
		<div
			className={cn(
				"relative min-w-0 overflow-hidden border-y border-border bg-muted/20 px-2 py-1.5",
				className,
			)}
		>
			<div className="flex min-w-0 flex-wrap items-baseline gap-1">
				{repoName ? (
					<span className="flex min-w-0 max-w-full items-center gap-1">
						{isWorktree ? (
							<TbGitFork
								className="size-3.5 shrink-0 text-muted-foreground/45"
								aria-hidden
							/>
						) : (
							<LuFolder
								className="size-3.5 shrink-0 text-muted-foreground/45"
								aria-hidden
							/>
						)}
						<span
							className="truncate text-xs font-medium text-foreground/85"
							title={repoName}
						>
							{repoName}
						</span>
					</span>
				) : null}
				{repoName && branch ? (
					<span className="shrink-0 text-muted-foreground/45" aria-hidden>
						·
					</span>
				) : null}
				{branch ? (
					<span
						className="flex min-w-0 max-w-full items-center gap-1"
						title={branch}
					>
						<TbGitBranch
							className="size-3.5 shrink-0 text-muted-foreground/45"
							aria-hidden
						/>
						<span className="truncate text-xs text-muted-foreground/70">
							{branch}
						</span>
					</span>
				) : null}
			</div>
		</div>
	);
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
	const formId = useId();
	const titleFieldId = `${formId}-commit-title`;
	const descriptionFieldId = `${formId}-commit-description`;
	const passphraseFieldId = `${formId}-passphrase`;
	const spinnerChar = useSpinner(phase === "working");
	const abortRef = useRef(false);
	const prevCwdRef = useRef<string | null>(null);

	const composeDialogOpen =
		phase === "compose" || (phase === "working" && !!workLabel);

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

	function closeComposeDialog() {
		if (phase === "working") {
			abort();
			return;
		}
		setPhase("idle");
		setCommitTitle("");
		setCommitDescription("");
		setGenerating(false);
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
			closeComposeDialog();
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

			<Dialog
				open={composeDialogOpen}
				onOpenChange={(open) => {
					if (!open) closeComposeDialog();
				}}
			>
				<DialogContent
					showCloseButton={phase !== "working"}
					className={cn(
						"gap-0 p-0 sm:max-w-[440px]",
						"[&>button]:text-muted-foreground/50 [&>button]:hover:text-muted-foreground",
					)}
				>
					<DialogHeader className="space-y-0 border-b border-border px-4 py-3 text-left">
						<DialogTitle className="text-xs font-medium tracking-wide text-muted-foreground">
							{phase === "working" ? workLabel : "Commit & Push"}
						</DialogTitle>
						{phase === "compose" && (
							<DialogDescription className="sr-only">
								Enter a commit title and optional description, then commit and push
								staged changes.
							</DialogDescription>
						)}
					</DialogHeader>

					{phase === "compose" ? (
						<>
							<div className="flex flex-col gap-4 px-4 py-4">
								<RepoBranchMeta
									repoName={repoName}
									branch={branch}
									isWorktree={isWorktree}
									className="-mx-4 w-[calc(100%+2rem)] max-w-none border-x-0 border-t-0"
								/>
								<div className="flex flex-col gap-2">
									<Label
										htmlFor={titleFieldId}
										className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50"
									>
										Title
									</Label>
									<Input
										ref={titleInputRef}
										id={titleFieldId}
										value={commitTitle}
										onChange={(e) => setCommitTitle(e.target.value)}
										placeholder="Short summary (required)"
										autoComplete="off"
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label
										htmlFor={descriptionFieldId}
										className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50"
									>
										Description
									</Label>
									<Textarea
										id={descriptionFieldId}
										value={commitDescription}
										onChange={(e) => setCommitDescription(e.target.value)}
										placeholder="Optional body"
										rows={4}
									/>
								</div>
							</div>
							<DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border bg-muted/50 px-4 py-3 sm:justify-between">
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="w-full gap-1.5 sm:mr-auto sm:w-auto"
									onClick={handleGenerateAi}
									disabled={generating}
								>
									<LuWandSparkles
										className={cn(
											"size-3.5 shrink-0 opacity-90",
											generating && "animate-pulse",
										)}
										aria-hidden
									/>
									{generating ? "Generating…" : "Generate with AI"}
								</Button>
								<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:w-auto sm:justify-end">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={closeComposeDialog}
									>
										Cancel
									</Button>
									<Button
										type="button"
										size="sm"
										onClick={runCommitAndPushFromCompose}
										disabled={!commitTitle.trim()}
									>
										Commit & Push
									</Button>
								</div>
							</DialogFooter>
						</>
					) : (
						<div className="flex items-center gap-3 px-4 py-10">
							<span className="font-mono text-sm" aria-hidden>
								{spinnerChar}
							</span>
							<p className="text-sm text-muted-foreground">{workLabel}</p>
						</div>
					)}
				</DialogContent>
			</Dialog>

			<Dialog
				open={phase === "passphrase"}
				onOpenChange={(open) => {
					if (!open) abort();
				}}
			>
				<DialogContent
					className={cn(
						"gap-0 p-0 sm:max-w-[420px]",
						"[&>button]:text-muted-foreground/50 [&>button]:hover:text-muted-foreground",
					)}
				>
					<DialogHeader className="space-y-0 border-b border-border px-4 py-3 text-left">
						<DialogTitle className="text-xs font-medium tracking-wide text-muted-foreground">
							{passphraseError ? "Incorrect passphrase — try again" : "Passphrase required"}
						</DialogTitle>
						<DialogDescription className="sr-only">
							Enter your SSH key passphrase to push to the remote.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-5 px-4 py-4">
						<RepoBranchMeta
							repoName={repoName}
							branch={branch}
							isWorktree={isWorktree}
							className="-mx-4 w-[calc(100%+2rem)] max-w-none border-x-0 border-t-0"
						/>
						{passphraseHint && (
							<p className="text-xs text-muted-foreground">{passphraseHint}</p>
						)}
						<div className="flex flex-col gap-2">
							<Label
								htmlFor={passphraseFieldId}
								className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50"
							>
								Passphrase
							</Label>
							<div className="relative">
								<Input
									ref={passphraseInputRef}
									id={passphraseFieldId}
									type={showPassphrase ? "text" : "password"}
									value={passphrase}
									onChange={(e) => setPassphrase(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handlePassphraseSubmit();
									}}
									placeholder="Enter passphrase…"
									className="pr-9"
									autoComplete="off"
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
						</div>
					</div>
					<DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border bg-muted/50 px-4 py-3 sm:justify-end">
						<Button type="button" variant="outline" size="sm" onClick={abort}>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={handlePassphraseSubmit}
							disabled={!passphrase.trim()}
						>
							Push
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={phase === "error"}
				onOpenChange={(open) => {
					if (!open) abort();
				}}
			>
				<DialogContent
					className={cn(
						"gap-0 p-0 sm:max-w-[520px]",
						"[&>button]:text-muted-foreground/50 [&>button]:hover:text-muted-foreground",
					)}
				>
					<DialogHeader className="space-y-2 border-b border-border px-4 py-3 pr-10 text-left">
						<DialogTitle className="text-destructive">{errorTitle}</DialogTitle>
						<RepoBranchMeta
							repoName={repoName}
							branch={branch}
							isWorktree={isWorktree}
							className="-mx-4 mt-1 w-[calc(100%+2rem)] max-w-none border-x-0 border-t-0"
						/>
						<DialogDescription className="sr-only">
							Error details from git or the shell.
						</DialogDescription>
					</DialogHeader>
					<div className="px-4 py-4">
						<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/80">
							{errorMessage}
						</pre>
					</div>
					<DialogFooter className="mx-0 mb-0 rounded-b-xl border-t border-border bg-muted/50 px-4 py-3 sm:justify-end">
						<Button type="button" variant="outline" size="sm" onClick={abort}>
							Dismiss
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
