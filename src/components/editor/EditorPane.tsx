import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { useEditorStore } from "@/store/editor";
import { useSettingsStore } from "@/store/settings";
import { getLanguageExtension } from "@/lib/editorLanguages";
import { getEditorTheme, blackBgOverride } from "@/lib/editorThemes";

interface Props {
  onCursorChange: (line: number, col: number) => void;
}

export function EditorPane({ onCursorChange }: Props) {
  const { openFiles, activeFilePath, updateFileContent } = useEditorStore();
  const { terminalTheme } = useSettingsStore();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const theme = useMemo(() => getEditorTheme(terminalTheme), [terminalTheme]);

  const extensions = useMemo(
    () => [
      ...(activeFile ? getLanguageExtension(activeFile.language) : []),
      blackBgOverride,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFile?.language]
  );

  if (!activeFile) {
    return (
      <div
        className="flex flex-1 min-h-0 items-center justify-center"
        style={{ backgroundColor: "var(--chrome-sidebar-surface)" }}
      >
        <span className="text-[11px] text-muted-foreground/25 font-mono select-none">
          Open a file from the tree to start editing
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-black">
      <CodeMirror
        key={activeFile.path}
        value={activeFile.content}
        height="100%"
        theme={theme}
        extensions={extensions}
        onChange={(value) => updateFileContent(activeFile.path, value)}
        onStatistics={(data) => {
          // column = cursor offset from line start (0-indexed) + 1
          const col = data.selectionAsSingle.from - data.line.from + 1;
          onCursorChange(data.line.number, col);
        }}
        style={{
          height: "100%",
          fontSize: "13px",
          fontFamily: "Geist Mono Variable, ui-monospace, monospace",
        }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
}
