import { useEditorStore } from "@/store/editor";
import { LuX } from "react-icons/lu";

export function EditorTabs() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();

  if (openFiles.length === 0) {
    return (
      <div
        className="editor-tabs-bar flex items-center h-8 shrink-0 border-b border-border px-2"
        style={{ backgroundColor: "var(--chrome-sidebar-surface)" }}
      >
        <span className="text-[11px] text-muted-foreground/40 select-none">
          No files open
        </span>
      </div>
    );
  }

  return (
    <div
      className="editor-tabs-bar flex items-center h-8 shrink-0 border-b border-border overflow-x-auto"
      style={{ backgroundColor: "var(--chrome-sidebar-surface)" }}
    >
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className={[
              "group flex items-center gap-1.5 h-full px-3 shrink-0 cursor-pointer select-none",
              "border-r border-border text-[11px] font-mono",
              "transition-colors",
              isActive
                ? "bg-white/[0.06] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]",
            ].join(" ")}
            onClick={() => setActiveFile(file.path)}
          >
            {/* Dirty indicator */}
            {file.isDirty && (
              <span className="size-1.5 rounded-full bg-amber-400/80 shrink-0" />
            )}

            <span className="max-w-[140px] truncate">{file.name}</span>

            {/* Close button */}
            <button
              className={[
                "ml-0.5 rounded-sm p-0.5 shrink-0",
                "text-muted-foreground/50 hover:text-foreground hover:bg-white/10",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                isActive ? "opacity-60" : "",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              aria-label={`Close ${file.name}`}
            >
              <LuX className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
