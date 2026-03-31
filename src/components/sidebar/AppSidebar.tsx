import { useCallback } from "react";
import { FaFolderOpen } from "react-icons/fa";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/store/sessions";
import { confirmCloseWorkspace } from "@/lib/closeConfirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceItem } from "@/components/sidebar/WorkspaceItem";
import { getWorkspaceDisplaySession } from "@/components/sidebar/getWorkspaceDisplaySession";

/**
 * Left rail: list of workspaces (each may have multiple terminal tabs).
 * Picking a row calls `activateWorkspace`; × removes the workspace without affecting others.
 */
export function AppSidebar() {
	const { workspaces, activeWorkspaceId, closeWorkspace, activateWorkspace } =
		useSessionStore();

	const requestCloseWorkspaceFromSidebar = useCallback(
		async (workspaceId: string) => {
			const ws = workspaces.find((w) => w.id === workspaceId);
			if (!ws) return;
			const ok = await confirmCloseWorkspace(ws);
			if (ok) closeWorkspace(workspaceId);
		},
		[closeWorkspace, workspaces],
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
				<SidebarContent>
					<SidebarGroup className="px-1.5">
						<SidebarGroupContent>
							<SidebarMenu className="gap-1">
								{workspaces.map((workspace, index) => {
									const session = getWorkspaceDisplaySession(workspace);
									return (
										<WorkspaceItem
											key={workspace.id}
											workspace={workspace}
											session={session}
											index={index}
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
