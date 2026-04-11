export function WikiRgFailedCallout({ detail }: { detail?: string }) {
	return (
		<div className="px-4 py-5 text-xs leading-relaxed text-muted-foreground/80">
			<p className="font-medium text-foreground/85">
				Couldn&apos;t list markdown files with ripgrep.
			</p>
			<p className="mt-2">
				Very large directories, memory pressure, or an unexpected ripgrep error
				can cause this. Try opening the wiki picker from a{" "}
				<strong className="text-foreground/80">smaller folder</strong> (e.g. a
				subdirectory of your project).
			</p>
			{detail ? (
				<p className="mt-4 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 font-mono text-[10px] text-muted-foreground/70 break-all">
					{detail}
				</p>
			) : null}
		</div>
	);
}
