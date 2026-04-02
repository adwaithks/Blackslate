import {
	TbLayoutSidebarFilled,
	TbLayoutSidebarRightFilled,
} from "react-icons/tb";
import { Button } from "@/components/ui/button";

export interface TitlebarGitPanelToggleProps {
	open: boolean;
	onToggle: () => void;
}

export function TitlebarGitPanelToggle({
	open,
	onToggle,
}: TitlebarGitPanelToggleProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onToggle}
			title="Toggle git panel (⌘L)"
			aria-label={open ? "Hide git panel" : "Show git panel"}
			aria-pressed={open}
			className="h-6 w-6 shrink-0 px-1 text-muted-foreground hover:text-foreground"
		>
			{open ? (
				<TbLayoutSidebarRightFilled
					className="size-4.5 shrink-0"
					aria-hidden
				/>
			) : (
				<TbLayoutSidebarFilled className="size-4.5 shrink-0" aria-hidden />
			)}
		</Button>
	);
}
