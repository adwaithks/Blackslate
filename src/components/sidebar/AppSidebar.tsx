import { GitBranch, X } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSessionStore, sessionDisplayName, type Session } from "@/store/sessions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Session item
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: Session;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function SessionItem({ session, index, isActive, onActivate, onClose }: SessionItemProps) {
  const dirName = sessionDisplayName(session);
  const { git } = session;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onActivate}
        className="group/item h-auto py-2 px-2 flex-col items-start gap-2"
        tooltip={session.cwd}
      >
        {/* Row 1: status dot + "#N dirname" — primary */}
        <div className="flex items-center gap-2 w-full">
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0 transition-colors",
              isActive ? "bg-emerald-400" : "bg-muted-foreground/25"
            )}
          />
          <span className="font-semibold text-[13px] tracking-tight truncate leading-none">
            <span className="text-muted-foreground/35 mr-2">#{index + 1}</span>
            {dirName}
          </span>
        </div>

        {/* Row 2: cwd path — secondary */}
        <span className="pl-[14px] text-[11px] text-muted-foreground/35 truncate w-full leading-none tracking-wide">
          {session.cwd}
        </span>

        {/* Row 3: git branch + dirty dot — only when in a repo */}
        {git && (
          <div className="pl-[14px] flex items-center gap-1.5 w-full min-w-0">
            <GitBranch className="size-2.5 shrink-0 text-muted-foreground/35" />
            <span className="text-[11px] text-muted-foreground/45 truncate leading-none tracking-wide">
              {git.branch}
            </span>
            {git.dirty && (
              <span className="size-1.5 rounded-full bg-amber-400/70 shrink-0" />
            )}
          </div>
        )}
      </SidebarMenuButton>

      <SidebarMenuAction
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        showOnHover
      >
        <X className="size-3" />
        <span className="sr-only">Close session</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function AppSidebar() {
  const { sessions, activeId, closeSession, activateSession } = useSessionStore();

  return (
    <Sidebar collapsible="none">
      <SidebarContent>
        <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {sessions.map((session, index) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  index={index}
                  isActive={session.id === activeId}
                  onActivate={() => activateSession(session.id)}
                  onClose={() => closeSession(session.id)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
