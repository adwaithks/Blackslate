import { useState } from "react";
import { useEditorStore } from "@/store/editor";
import {
	useSettingsStore,
	DEFAULT_FILE_TREE_WIDTH,
} from "@/store/settings";
import { usePanelResize } from "@/hooks/usePanelResize";
import { EditorSidebar } from "./EditorSidebar";
import { EditorTabs } from "./EditorTabs";
import { EditorPane } from "./EditorPane";
import { EditorStatusBar } from "./EditorStatusBar";

interface EditorViewProps {
	editorPanelWidth: number;
}

export function EditorView({ editorPanelWidth }: EditorViewProps) {
	const { isOpen, rootPath } = useEditorStore();
	const { fileTreeWidth: persistedFileTreeWidth, setFileTreeWidth } =
		useSettingsStore();

	const [cursorLine, setCursorLine] = useState(1);
	const [cursorCol, setCursorCol] = useState(1);

	const { width: fileTreeWidth, startDrag: startFileTreeDrag } = usePanelResize({
		initialWidth: persistedFileTreeWidth ?? DEFAULT_FILE_TREE_WIDTH,
		min: 140,
		max: 480,
		direction: 1,
		onEnd: setFileTreeWidth,
	});

	if (!isOpen) return null;

	return (
		<div
			className="flex h-full shrink-0"
			style={{
				width: editorPanelWidth,
				backgroundColor: "var(--chrome-sidebar-surface)",
			}}
		>
			{/* File tree sidebar — key=rootPath so it remounts (clears cache) on dir change */}
			<EditorSidebar
				key={rootPath ?? "__no_root__"}
				width={fileTreeWidth}
			/>

			{/* Handle 2: file tree ↔ code pane */}
			<div
				className="w-1 shrink-0 cursor-col-resize hover:bg-border/60 active:bg-border transition-colors z-10"
				onMouseDown={startFileTreeDrag}
			/>

			{/* Editor area */}
			<div className="flex flex-col flex-1 min-w-0 h-full">
				<EditorTabs />
				<EditorPane
					onCursorChange={(line, col) => {
						setCursorLine(line);
						setCursorCol(col);
					}}
				/>
				<EditorStatusBar
					cursorLine={cursorLine}
					cursorCol={cursorCol}
				/>
			</div>
		</div>
	);
}
