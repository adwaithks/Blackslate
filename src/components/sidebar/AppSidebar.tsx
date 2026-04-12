import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { FaFolderOpen } from "react-icons/fa";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
} from "@/components/ui/sidebar";
import { selectSidebarDisplaySignature, useTerminalStore } from "@/store/terminals";
import { confirmCloseWorkspace } from "@/lib/closeConfirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceItem } from "@/components/sidebar/WorkspaceItem";
import { getWorkspaceDisplayTerminal } from "@/components/sidebar/getWorkspaceDisplayTerminal";

// Left list of workspaces (each can have several tabs). Click a row to open that workspace; × closes just that one.
export function AppSidebar() {
	useTerminalStore(selectSidebarDisplaySignature);
	const { closeWorkspace, activateWorkspace, createWorkspace } = useTerminalStore(
		useShallow((s) => ({
			closeWorkspace: s.closeWorkspace,
			activateWorkspace: s.activateWorkspace,
			createWorkspace: s.createWorkspace,
		})),
	);
	const { workspaces, activeWorkspaceId } = useTerminalStore.getState();

	const requestCloseWorkspaceFromSidebar = useCallback(
		async (workspaceId: string) => {
			const ws = useTerminalStore
				.getState()
				.workspaces.find((w) => w.id === workspaceId);
			if (!ws) return;
			const ok = await confirmCloseWorkspace(ws);
			if (ok) closeWorkspace(workspaceId);
		},
		[closeWorkspace],
	);

	return (
		<TooltipProvider>
			<Sidebar collapsible="offcanvas">
				{/* pt-12: clear the custom titlebar (z-20); sidebar stays z-10 */}
				<SidebarHeader className="pt-12">
					<span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-muted-foreground/70">
						<FaFolderOpen
							className="size-3 shrink-0 text-muted-foreground/55"
							aria-hidden
						/>
						Workspaces
					</span>
				</SidebarHeader>
				<SidebarContent
					onDoubleClick={(e) => {
						// Only fire on empty space — not when double-clicking a workspace item.
						if ((e.target as Element).closest("li")) return;
						createWorkspace();
					}}
				>
					<SidebarGroup className="px-1.5">
						<SidebarGroupContent>
							<SidebarMenu className="gap-1">
								{workspaces.map((workspace) => {
									const terminal = getWorkspaceDisplayTerminal(workspace);
									return (
										<WorkspaceItem
											key={workspace.id}
											workspace={workspace}
											terminal={terminal}
											isActive={
												workspace.id === activeWorkspaceId
											}
											onActivate={() =>
												activateWorkspace(workspace.id)
											}
											onClose={() =>
												requestCloseWorkspaceFromSidebar(
													workspace.id,
												)
											}
										/>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</TooltipProvider>
	);
}
