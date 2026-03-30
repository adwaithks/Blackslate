import { openUrl } from "@tauri-apps/plugin-opener";
import type { Terminal } from "@xterm/xterm";

// Same regex WebLinksAddon uses — handles trailing punctuation correctly.
const URL_REGEX_SRC =
	/(https?|ftp):\/\/[^\s"'<>[\]{}|\\^`]*[^\s"':,.!?{}|\\^~[\]`()<>]/.source;

/**
 * Registers xterm link handling for this instance:
 * - `registerLinkProvider`: hover + click opens URL via Tauri opener.
 * - `onWriteParsed` + decorations: persistent blue underline on URL text in the buffer.
 */
export function attachTerminalUrlLinking(term: Terminal): void {
	term.registerLinkProvider({
		provideLinks(lineNumber, callback) {
			const line = term.buffer.active.getLine(lineNumber - 1);
			if (!line) {
				callback(undefined);
				return;
			}
			const text = line.translateToString(true);
			const re = new RegExp(URL_REGEX_SRC, "g");
			const links: Parameters<typeof callback>[0] = [];
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) !== null) {
				const url = m[0];
				const x = m.index;
				links!.push({
					range: {
						start: { x: x + 1, y: lineNumber },
						end: { x: x + url.length, y: lineNumber },
					},
					text: url,
					decorations: { pointerCursor: true, underline: true },
					activate(_e, uri) {
						openUrl(uri).catch(console.error);
					},
				});
			}
			callback(links!.length ? links : undefined);
		},
	});

	// Permanent blue underline for URLs using buffer decorations.
	// onWriteParsed runs after each PTY write is parsed — scan a few lines above the
	// cursor and attach a border-bottom layer over each URL span.
	const decoratedLines = new Set<number>();
	term.onWriteParsed(() => {
		const active = term.buffer.active;
		const cursorAbsY = active.baseY + active.cursorY;
		for (
			let absY = Math.max(0, cursorAbsY - 3);
			absY <= cursorAbsY;
			absY++
		) {
			if (decoratedLines.has(absY)) continue;
			const line = active.getLine(absY);
			if (!line) continue;
			const text = line.translateToString(true);
			const re = new RegExp(URL_REGEX_SRC, "g");
			let m: RegExpExecArray | null;
			let marker: ReturnType<typeof term.registerMarker> | undefined;
			decoratedLines.add(absY);
			while ((m = re.exec(text)) !== null) {
				if (!marker) {
					marker = term.registerMarker(absY - cursorAbsY) ?? undefined;
					if (!marker) break;
					marker.onDispose(() => decoratedLines.delete(absY));
				}
				term.registerDecoration({
					marker,
					x: m.index,
					width: m[0].length,
					foregroundColor: "#569cd6",
					layer: "top",
				})?.onRender((el) => {
					el.style.boxSizing = "border-box";
					el.style.borderBottom = "1px solid rgba(86,156,214,0.7)";
					el.style.pointerEvents = "none";
				});
			}
		}
	});
}
