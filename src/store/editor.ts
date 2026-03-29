import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenFile {
  /** Absolute path */
  path: string;
  /** Basename, e.g. "main.rs" */
  name: string;
  /** File content as loaded from disk */
  content: string;
  /** True when in-memory content differs from the saved version */
  isDirty: boolean;
  /** Language identifier used for CodeMirror extension selection */
  language: string;
}

interface EditorStore {
  // ── Panel state ────────────────────────────────────────────────────────────
  isOpen: boolean;

  // ── Root path — drives the file tree ─────────────────────────────────────
  /** Absolute path shown as the tree root. Null until the first cwd is received. */
  rootPath: string | null;

  // ── Open file tabs ────────────────────────────────────────────────────────
  openFiles: OpenFile[];
  activeFilePath: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  openEditor: () => void;
  closeEditor: () => void;
  toggleEditor: () => void;

  setRootPath: (path: string) => void;

  /**
   * Open a file. If it is already open, just activate it.
   * Otherwise prepend it to the tab list and activate.
   */
  openFile: (path: string, name: string, content: string, language: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;

  /** Called by CodeMirror's onChange — marks the file dirty. */
  updateFileContent: (path: string, content: string) => void;
  /** Called after a successful fs_write_file — clears dirty flag. */
  markFileSaved: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorStore>((set, get) => ({
  isOpen: false,
  rootPath: null,
  openFiles: [],
  activeFilePath: null,

  openEditor: () => set({ isOpen: true }),
  closeEditor: () => set({ isOpen: false }),
  toggleEditor: () => set((s) => ({ isOpen: !s.isOpen })),

  setRootPath: (path) => set({ rootPath: path }),

  openFile(path, name, content, language) {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }
    const file: OpenFile = { path, name, content, isDirty: false, language };
    set((s) => ({
      openFiles: [file, ...s.openFiles],
      activeFilePath: path,
    }));
  },

  closeFile(path) {
    const { openFiles, activeFilePath } = get();
    const idx = openFiles.findIndex((f) => f.path === path);
    if (idx === -1) return;

    const next = openFiles.filter((f) => f.path !== path);

    let nextActive = activeFilePath;
    if (activeFilePath === path) {
      // Activate the nearest remaining tab
      const candidate = next[Math.max(0, idx - 1)];
      nextActive = candidate?.path ?? null;
    }

    set({ openFiles: next, activeFilePath: nextActive });
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent(path, content) {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    }));
  },

  markFileSaved(path) {
    set((s) => ({
      openFiles: s.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: false } : f
      ),
    }));
  },
}));
