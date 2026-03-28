import { useSessionStore } from "@/store/sessions";
import { TerminalPane } from "./TerminalPane";

/**
 * Renders a TerminalPane for every session simultaneously.
 *
 * All panes are mounted and their PTYs stay alive regardless of which session
 * is active — switching sessions is instant with zero shell state loss.
 *
 * Inactive panes use `visibility: hidden` (not `display: none`) so that
 * xterm.js can still measure container dimensions via ResizeObserver.  When a
 * pane becomes active it is already correctly sized; we just focus it.
 */
export function TerminalView() {
  const { sessions, activeId } = useSessionStore();

  return (
    <div className="relative w-full h-full">
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        return (
          <div
            key={session.id}
            className="absolute inset-0"
            style={{ visibility: isActive ? "visible" : "hidden" }}
          >
            <TerminalPane sessionId={session.id} isActive={isActive} />
          </div>
        );
      })}
    </div>
  );
}
