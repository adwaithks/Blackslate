import type { ITheme } from "@xterm/xterm";

/**
 * Terminal colour themes.
 *
 * Each function accepts a `background` override so the caller can force pure
 * black (or any other surface) without touching the rest of the palette.
 *
 * Usage in TerminalPane.tsx:
 *   import { gruvboxDark } from "@/lib/terminalThemes";
 *   theme: gruvboxDark(TERMINAL_SURFACE),
 */

// ─── Gruvbox Dark ────────────────────────────────────────────────────────────
// https://github.com/morhetz/gruvbox
// Warm amber/cream on dark — beloved by vim users and shell nerds.
export function gruvboxDark(background = "#1d2021"): ITheme {
	return {
		background,
		foreground:          "#ebdbb2", // fg1
		cursor:              "#ebdbb2",
		cursorAccent:        "#1d2021",
		selectionBackground: "#a8998455", // bg4 @ ~33%

		black:         "#1d2021", // dark0_hard
		red:           "#cc241d", // neutral_red
		green:         "#98971a", // neutral_green
		yellow:        "#d79921", // neutral_yellow  ← dirs, timestamps
		blue:          "#458588", // neutral_blue
		magenta:       "#b16286", // neutral_purple
		cyan:          "#689d6a", // neutral_aqua
		white:         "#a89984", // fg4

		brightBlack:   "#928374", // gray
		brightRed:     "#fb4934", // bright_red
		brightGreen:   "#b8bb26", // bright_green    ← executables
		brightYellow:  "#fabd2f", // bright_yellow   ← dirs (bold ls)
		brightBlue:    "#83a598", // bright_blue
		brightMagenta: "#d3869b", // bright_purple
		brightCyan:    "#8ec07c", // bright_aqua
		brightWhite:   "#ebdbb2", // fg1
	};
}

// ─── Dracula ─────────────────────────────────────────────────────────────────
// https://draculatheme.com
// Vivid purple/pink on near-black — VS Code / JetBrains crowd favourite.
export function dracula(background = "#282a36"): ITheme {
	return {
		background,
		foreground:          "#f8f8f2",
		cursor:              "#f8f8f2",
		cursorAccent:        "#282a36",
		selectionBackground: "#44475a99",

		black:         "#21222c",
		red:           "#ff5555",
		green:         "#50fa7b",
		yellow:        "#f1fa8c",
		blue:          "#bd93f9",
		magenta:       "#ff79c6",
		cyan:          "#8be9fd",
		white:         "#f8f8f2",

		brightBlack:   "#6272a4", // comment
		brightRed:     "#ff6e6e",
		brightGreen:   "#69ff94", // ← executables (very vivid)
		brightYellow:  "#ffffa5",
		brightBlue:    "#d6acff",
		brightMagenta: "#ff92df",
		brightCyan:    "#a4ffff",
		brightWhite:   "#ffffff",
	};
}

// ─── Tokyo Night ─────────────────────────────────────────────────────────────
// https://github.com/folke/tokyonight.nvim
// Moody deep-blue night palette — extremely popular 2023-2025, very "aesthetic".
export function tokyoNight(background = "#1a1b26"): ITheme {
	return {
		background,
		foreground:          "#c0caf5", // fg
		cursor:              "#c0caf5",
		cursorAccent:        "#1a1b26",
		selectionBackground: "#283457bb",

		black:         "#15161e", // bg_dark
		red:           "#f7768e", // red
		green:         "#9ece6a", // green       ← executables
		yellow:        "#e0af68", // yellow      ← dirs
		blue:          "#7aa2f7", // blue
		magenta:       "#bb9af7", // purple
		cyan:          "#7dcfff", // cyan
		white:         "#a9b1d6", // fg_dark

		brightBlack:   "#414868", // comment
		brightRed:     "#f7768e",
		brightGreen:   "#9ece6a",
		brightYellow:  "#e0af68",
		brightBlue:    "#7aa2f7",
		brightMagenta: "#bb9af7",
		brightCyan:    "#7dcfff",
		brightWhite:   "#c0caf5",
	};
}

// ─── Nord ─────────────────────────────────────────────────────────────────────
// https://www.nordtheme.com
// Cool arctic blues and muted accents — clean, modern, very easy on the eyes.
export function nord(background = "#2e3440"): ITheme {
	return {
		background,
		foreground:          "#d8dee9",
		cursor:              "#d8dee9",
		cursorAccent:        "#2e3440",
		selectionBackground: "#4c566a99",

		black:         "#3b4252", // nord1
		red:           "#bf616a", // nord11
		green:         "#a3be8c", // nord14
		yellow:        "#ebcb8b", // nord13  ← dirs
		blue:          "#81a1c1", // nord9
		magenta:       "#b48ead", // nord15
		cyan:          "#88c0d0", // nord8
		white:         "#e5e9f0", // nord5

		brightBlack:   "#4c566a", // nord3
		brightRed:     "#bf616a",
		brightGreen:   "#a3be8c", // ← executables
		brightYellow:  "#ebcb8b",
		brightBlue:    "#81a1c1",
		brightMagenta: "#b48ead",
		brightCyan:    "#8fbcbb", // nord7
		brightWhite:   "#eceff4", // nord6
	};
}

// ─── Solarized Dark ──────────────────────────────────────────────────────────
// https://github.com/altercation/solarized
// Canonical teal-base palette — one of the most widely adopted terminal themes.
export function solarizedDark(background = "#002b36"): ITheme {
	return {
		background,
		foreground:          "#839496", // base0
		cursor:              "#839496",
		cursorAccent:        "#002b36",
		selectionBackground: "#586e7580", // base01 @ ~50%

		black:         "#073642", // base02
		red:           "#dc322f",
		green:         "#859900",
		yellow:        "#b58900",
		blue:          "#268bd2",
		magenta:       "#d33682",
		cyan:          "#2aa198",
		white:         "#eee8d5", // base2

		brightBlack:   "#586e75", // base01
		brightRed:     "#cb4b16", // orange
		brightGreen:   "#586e75",
		brightYellow:  "#657b83", // base00
		brightBlue:    "#839496", // base0
		brightMagenta: "#6c71c4", // violet
		brightCyan:    "#93a1a1", // base1
		brightWhite:   "#fdf6e3", // base3
	};
}
