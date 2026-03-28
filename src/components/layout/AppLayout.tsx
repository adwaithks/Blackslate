import { useEffect } from "react";
import { Plus } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { TerminalView } from "@/components/terminal/TerminalView";
import { useSessionStore } from "@/store/sessions";
import { useSettingsStore } from "@/store/settings";

export function AppLayout() {
  const { sessions, activeId, createSession } = useSessionStore();
  const activeCwd = sessions.find((s) => s.id === activeId)?.cwd ?? "~";
  const { increaseFontSize, decreaseFontSize } = useSettingsStore();

  // Cmd+= / Cmd++  →  zoom in     Cmd+-  →  zoom out
  // Capture phase fires before xterm's listener so preventDefault() stops
  // the character from being forwarded to the PTY.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        e.stopPropagation();
        increaseFontSize();
      } else if (e.key === "-") {
        e.preventDefault();
        e.stopPropagation();
        decreaseFontSize();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [increaseFontSize, decreaseFontSize]);

  return (
    <SidebarProvider
      open={true}
      onOpenChange={() => {}}
      style={{ "--sidebar-width": "270px" } as React.CSSProperties}
    >
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* macOS titlebar — the whole strip is a drag region; interactive children
            (Button) capture pointer events before they bubble so they stay clickable */}
        <div
          data-tauri-drag-region
          className="flex h-[32px] shrink-0 items-center gap-0 border-b border-border"
        >
          {/* Dead zone that clears the three traffic-light buttons (~76 px on macOS) */}
          <div className="w-[76px] shrink-0" />

          <Button variant="ghost" size="sm" onClick={createSession} className="gap-1.5 text-muted-foreground px-2">
            <Plus className="size-3.5" />
            New Tab
          </Button>

          {/* Active session path — participates in drag, no interaction */}
          <span className="text-xs text-muted-foreground/50 truncate font-mono select-none ml-2 leading-none">
            {activeCwd}
          </span>
        </div>

        {/* Main content: sidebar + terminal */}
        <div className="flex flex-1">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            <TerminalView />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
