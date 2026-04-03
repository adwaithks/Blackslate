import { LuChevronRight } from "react-icons/lu";
import { stripFrontmatter } from "./markdown";
import { relativeParts } from "./paths";
import { useReadSkillFile } from "./useReadSkillFile";

export function FileContent({
	path,
	rootDir,
	isSkillMd,
}: {
	path: string;
	rootDir: string;
	isSkillMd: boolean;
}) {
	const { content, loading } = useReadSkillFile(path);
	const parts = relativeParts(path, rootDir);

	return (
		<div className="flex h-full flex-col min-h-0">
			<div className="shrink-0 flex items-center gap-1 border-b border-border px-4 py-2 text-[11px] text-muted-foreground/50">
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
			<div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8">
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
