import { memo, useEffect } from "react";
import { useSessionStore, findSession } from "@/store/sessions";
import { useAppConfigStore } from "@/store/appConfig";
import { usePty } from "@/hooks/usePty";
import { useTerminalBootstrap } from "@/hooks/useTerminalBootstrap";
import { useDebouncedTerminalFitResize } from "@/hooks/useDebouncedTerminalFitResize";
import { useTerminalSessionCwdMetadata } from "@/hooks/useTerminalSessionCwdMetadata";
import { useTerminalPaneLayoutEffects } from "@/hooks/useTerminalPaneLayoutEffects";
import { FOCUS_ACTIVE_TERMINAL_EVENT } from "@/lib/focusActiveTerminal";

interface TerminalPaneProps {
	sessionId: string;
	/**
	 * When true, this pane is the visible session.
	 * Triggers a fit + focus so the terminal is ready to use immediately
	 * after switching from another session.
	 */
	isActive: boolean;
	terminalSurface: string;
}

/**
 * One xterm surface + PTY bridge (`usePty`). All layout/font/theme side effects
 * live in hooks so this file stays a wiring diagram.
 *
 * ## Multi-session lifecycle
 * Parent keeps every `TerminalPane` mounted and hides inactive ones with
 * `visibility: hidden` so `fit()` still sees real dimensions. Activation
 * refits and focuses (see `useTerminalPaneLayoutEffects`).
 */
function TerminalPaneImpl({
	sessionId,
	isActive,
	terminalSurface,
}: TerminalPaneProps) {
	const fontSize = useAppConfigStore((s) => s.fontSize);
	const terminalThemeId = useAppConfigStore((s) => s.terminalTheme);

	const { containerRef, terminal, terminalRef, fitAddonRef } =
		useTerminalBootstrap(fontSize, terminalThemeId, terminalSurface);

	const { sendResize } = usePty({ terminal, sessionId });

	const debouncedFitAndResizeRef = useDebouncedTerminalFitResize(
		sendResize,
		fitAddonRef,
		terminalRef,
	);

	const cwd = useSessionStore(
		(s) => findSession(s.workspaces, sessionId)?.cwd ?? "~",
	);
	useTerminalSessionCwdMetadata(sessionId, cwd);

	useTerminalPaneLayoutEffects({
		terminal,
		fontSize,
		terminalThemeId,
		terminalSurface,
		containerRef,
		debouncedFitAndResizeRef,
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
		prev.sessionId === next.sessionId &&
		prev.isActive === next.isActive &&
		prev.terminalSurface === next.terminalSurface,
);
