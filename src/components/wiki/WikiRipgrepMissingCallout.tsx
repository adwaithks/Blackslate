const BLACKSLATE_README_URL =
	"https://github.com/adwaithks/Blackslate/blob/master/README.md";

export function WikiRipgrepMissingCallout({
	detail,
}: {
	detail?: string;
}) {
	return (
		<div className="px-4 py-5 text-xs leading-relaxed text-muted-foreground/80">
			<p className="font-medium text-foreground/85">
				The wiki picker needs the bundled{" "}
				<span className="font-mono text-[11px]">ripgrep</span> helper, but it
				isn&apos;t available.
			</p>
			<ul className="mt-3 list-disc space-y-2 pl-4">
				<li>
					If you <strong className="text-foreground/80">built from source</strong>,
					run <code className="rounded bg-muted/50 px-1 py-px font-mono text-[10px]">bun run setup:rg</code> once
					before <code className="rounded bg-muted/50 px-1 py-px font-mono text-[10px]">bun tauri dev</code> (see the
					project README).
				</li>
				<li>
					<strong className="text-foreground/80">Official release</strong> builds
					ship with this binary; you normally should not see this message there.
				</li>
			</ul>
			<p className="mt-4">
				<a
					href={BLACKSLATE_README_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="text-foreground/70 underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
				>
					Blackslate README — setup instructions
				</a>
			</p>
			{detail ? (
				<p className="mt-4 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 font-mono text-[10px] text-muted-foreground/60 break-all">
					{detail}
				</p>
			) : null}
		</div>
	);
}
