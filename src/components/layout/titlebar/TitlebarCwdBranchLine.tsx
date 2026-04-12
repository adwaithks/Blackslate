import { LuDot, LuFolder } from "react-icons/lu";
import { toast } from "sonner";
import {
	HEADER_REPO_ICON,
	HEADER_REPO_SEP,
	HEADER_REPO_TEXT,
} from "@/lib/headerRepoLineStyles";

export interface TitlebarCwdBranchLineProps {
	// Full folder path shown in the top bar.
	cwd: string;
	// Branch name for that folder, if we know it.
	branch: string | null;
}

function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text).then(() => {
		toast.success(`Copied ${text}`, { duration: 2000 });
	});
}

// Top bar line: folder icon, path, optional branch (matches what you see in the sidebar for that tab).
export function TitlebarCwdBranchLine({ cwd, branch }: TitlebarCwdBranchLineProps) {
	return (
		<span
			data-tauri-drag-region
			title={branch ? `${cwd} · ${branch}` : cwd}
			className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden text-xs leading-none select-none"
		>
			<LuFolder
				className={`size-3.5 shrink-0 ${HEADER_REPO_ICON}`}
				aria-hidden
			/>
			<span
				className={`min-w-0 max-w-[35cqw] shrink truncate ${HEADER_REPO_TEXT} cursor-pointer`}
				onDoubleClick={() => copyToClipboard(cwd)}
			>
				{cwd}
			</span>
			{branch ? (
				<>
					<LuDot
						className={`size-2.5 shrink-0 ${HEADER_REPO_SEP}`}
						aria-hidden
					/>
					<span
						className={`min-w-0 shrink truncate ${HEADER_REPO_TEXT} cursor-pointer`}
						onDoubleClick={() => copyToClipboard(branch)}
					>
						{branch}
					</span>
				</>
			) : null}
		</span>
	);
}
