import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitInfo {
  branch: string;
  dirty: boolean;
}

export interface Session {
  id: string;
  /** Current working directory, tilde-normalised (e.g. "~/Projects/Slate"). */
  cwd: string;
  /** Unix timestamp of when the session was created. */
  createdAt: number;
  /** Git info for the current cwd, null when not in a repo. */
  git: GitInfo | null;
}

interface SessionState {
  sessions: Session[];
  activeId: string;
}

interface SessionActions {
  /** Open a new session and make it active. */
  createSession: () => void;
  /**
   * Close a session. Activates the nearest sibling.
   * Closing the last session is a no-op — one session must always exist.
   */
  closeSession: (id: string) => void;
  /** Switch the visible terminal to the given session. */
  activateSession: (id: string) => void;
  /** Update the working directory for a session (called by the OSC 7 parser). */
  setCwd: (id: string, cwd: string) => void;
  /** Update the git info for a session (called after cwd changes). */
  setGit: (id: string, git: GitInfo | null) => void;
}

export type SessionStore = SessionState & SessionActions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(): Session {
  return {
    id: crypto.randomUUID(),
    cwd: "~",
    createdAt: Date.now(),
    git: null,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initial = makeSession();

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [initial],
  activeId: initial.id,

  createSession() {
    const session = makeSession();
    set((s) => ({ sessions: [...s.sessions, session], activeId: session.id }));
  },

  closeSession(id) {
    set((s) => {
      if (s.sessions.length <= 1) return s; // always keep one session alive

      const idx = s.sessions.findIndex((x) => x.id === id);
      const sessions = s.sessions.filter((x) => x.id !== id);

      // When closing the active session, activate the nearest sibling.
      const activeId =
        s.activeId === id
          ? sessions[Math.max(0, idx - 1)].id
          : s.activeId;

      return { sessions, activeId };
    });
  },

  activateSession(id) {
    set({ activeId: id });
  },

  setCwd(id, cwd) {
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, cwd } : x)),
    }));
  },

  setGit(id, git) {
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, git } : x)),
    }));
  },
}));

// ---------------------------------------------------------------------------
// Derived helpers (pure, no hooks)
// ---------------------------------------------------------------------------

/** Return the display name for a session: the last path segment, or "~". */
export function sessionDisplayName(session: Session): string {
  if (session.cwd === "~" || session.cwd === "/") return session.cwd;
  return session.cwd.split("/").filter(Boolean).pop() ?? "~";
}
