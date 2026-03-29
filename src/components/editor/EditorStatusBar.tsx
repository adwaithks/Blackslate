import { languageLabel } from "@/lib/editorLanguages";
import { useEditorStore } from "@/store/editor";

interface Props {
  cursorLine: number;
  cursorCol: number;
}

export function EditorStatusBar({ cursorLine, cursorCol }: Props) {
  const { openFiles, activeFilePath } = useEditorStore();
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div
      className="flex items-center justify-between h-6 shrink-0 px-3 border-t border-border"
      style={{ backgroundColor: "var(--chrome-sidebar-surface)" }}
    >
      <div className="flex items-center gap-3">
        {activeFile && (
          <span className="text-[10px] text-muted-foreground/60 font-mono select-none">
            {languageLabel(activeFile.language)}
          </span>
        )}
        {activeFile?.isDirty && (
          <span className="text-[10px] text-amber-400/70 font-mono select-none">
            ● unsaved
          </span>
        )}
      </div>
      {activeFile && (
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums select-none">
          Ln {cursorLine}, Col {cursorCol}
        </span>
      )}
    </div>
  );
}
