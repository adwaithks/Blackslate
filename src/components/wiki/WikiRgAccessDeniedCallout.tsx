export function WikiRgAccessDeniedCallout({ detail }: { detail?: string }) {
	return (
		<div className="px-4 py-5 text-xs leading-relaxed text-muted-foreground/80">
			<p className="font-medium text-foreground/85">
				This folder is too broad or macOS is blocking reads.
			</p>
			<p className="mt-2">
				Scanning your <strong className="text-foreground/80">whole home directory</strong>{" "}
				hits protected locations (Downloads, Library, Mail, Photos, iCloud, etc.).
				Ripgrep exits with errors there even when some paths are readable.
			</p>
			<p className="mt-2">
				<strong className="text-foreground/80">Fix:</strong>{" "}
				<code className="rounded bg-muted/50 px-1 py-px font-mono text-[10px]">cd</code> into
				a project (or open a session there) and open wikis again so the search root is a
				normal repo folder, not <code className="font-mono text-[10px]">~</code>.
			</p>
			{detail ? (
				<p className="mt-4 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 font-mono text-[10px] text-muted-foreground/70 break-all">
					{detail}
				</p>
			) : null}
		</div>
	);
}
