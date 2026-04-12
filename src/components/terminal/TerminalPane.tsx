import { memo, useEffect } from "react";
import { useAppConfigStore } from "@/store/appConfig";
import { usePty } from "@/hooks/pty/usePty";
import { useTerminalBootstrap } from "@/hooks/terminal/useTerminalBootstrap";
import { useTerminalGitInfoForCwd } from "@/hooks/terminal/useTerminalGitInfoForCwd";
import { useTerminalPaneLayoutSync } from "@/hooks/terminal/useTerminalPaneLayoutSync";
import { FOCUS_ACTIVE_TERMINAL_EVENT } from "@/lib/focusActiveTerminal";

interface TerminalPaneProps {
	terminalId: string;
	// True when this tab is the one you see; we resize and focus it when you switch here.
	isActive: boolean;
	terminalSurface: string;
}

// One terminal screen wired to the shell. Layout, font, and look are handled in hooks.
// Parent keeps every tab mounted; hidden tabs stay in the layout so resize still works.
// When a tab becomes visible, we resize and focus it (see useTerminalPaneLayoutSync).
function TerminalPaneImpl({
	terminalId,
	isActive,
	terminalSurface,
}: TerminalPaneProps) {
	const fontSize = useAppConfigStore((s) => s.fontSize);
	const terminalThemeId = useAppConfigStore((s) => s.terminalTheme);

	const { containerRef, terminal, terminalRef, fitAddonRef } =
		useTerminalBootstrap(fontSize, terminalThemeId, terminalSurface);

	const { sendResize } = usePty({ terminal, terminalId });

	useTerminalGitInfoForCwd(terminalId);

	// Match xterm size, colors, and font to the pane; resize the shell when the grid changes; refit when this tab is shown.
	useTerminalPaneLayoutSync({
		terminal,
		fontSize,
		terminalThemeId,
		terminalSurface,
		containerRef,
		terminalRef,
		isActive,
		fitAddonRef,
		sendResize,
	});

	useEffect(() => {
		if (!terminal) return;
		const onRequestFocus = () => {
			if (!isActive) return;
			requestAnimationFrame(() => {
				terminal.focus();
			});
		};
		window.addEventListener(FOCUS_ACTIVE_TERMINAL_EVENT, onRequestFocus);
		return () =>
			window.removeEventListener(
				FOCUS_ACTIVE_TERMINAL_EVENT,
				onRequestFocus,
			);
	}, [terminal, isActive]);

	return (
		<div
			className="w-full h-full pl-2 pt-2"
			style={{ backgroundColor: terminalSurface }}
			onClick={() => terminal?.focus()}
		>
			<div ref={containerRef} className="w-full h-full" />
		</div>
	);
}

export const TerminalPane = memo(
	TerminalPaneImpl,
	(prev, next) =>
		prev.terminalId === next.terminalId &&
		prev.isActive === next.isActive &&
		prev.terminalSurface === next.terminalSurface,
);
