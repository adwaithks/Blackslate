import { IoAdd } from "react-icons/io5";
import {
	TbLayoutSidebarFilled,
	TbLayoutSidebarRightFilled,
} from "react-icons/tb";
import { Button } from "@/components/ui/button";

export interface TitlebarSidebarSectionProps {
	sidebarOpen: boolean;
	onCreateWorkspace: () => void;
	onToggleSidebar: () => void;
}

// Top-left above the sidebar: new workspace button and show/hide sidebar.
export function TitlebarSidebarSection({
	sidebarOpen,
	onCreateWorkspace,
	onToggleSidebar,
}: TitlebarSidebarSectionProps) {
	return (
		<div
			data-tauri-drag-region
			className="flex min-w-0 items-center justify-end gap-0.5 bg-[var(--chrome-sidebar-surface)] pl-[76px] pr-2"
		>
			<Button
				variant="ghost"
				size="sm"
				onClick={onCreateWorkspace}
				className="h-6 shrink-0 px-1 text-muted-foreground rounded-sm"
				title="New workspace (⌘N)"
			>
				<IoAdd className="size-5 shrink-0" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onToggleSidebar}
				aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
				aria-pressed={sidebarOpen}
				className="h-6 w-6 shrink-0 px-1 text-muted-foreground hover:text-foreground"
			>
				{sidebarOpen ? (
					<TbLayoutSidebarFilled className="size-4.5 shrink-0" aria-hidden />
				) : (
					<TbLayoutSidebarRightFilled
						className="size-4.5 shrink-0"
						aria-hidden
					/>
				)}
			</Button>
		</div>
	);
}
