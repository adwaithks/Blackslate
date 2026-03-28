import { TerminalPane } from "./components/terminal/TerminalPane";

/**
 * Root of the application.
 *
 * Phase 1: single terminal session, full-window.
 * Phase 3 will replace this with a tab bar + session store.
 */
export default function App() {
  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden">
      <TerminalPane />
    </div>
  );
}
