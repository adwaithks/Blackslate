import type { ITheme } from "@xterm/xterm";

/** Dark themes: opaque light selection (xterm blends inactive selection; defaults read as gray/purple). */
const DARK_SELECTION_BG = "#ffffff";
const DARK_SELECTION_FG = "#000000";

/**
 * Terminal colour themes.
 *
 * Each function accepts a `background` override so the caller can force pure
 * black (or any other surface) without touching the rest of the palette.
 *
 * Dark themes have light foregrounds; light themes have dark foregrounds.
 * `resolveTerminalTheme` picks the correct variant based on surface luminance.
 *
 * Usage in TerminalPane.tsx:
 *   import { gruvboxDark } from "@/lib/terminalThemes";
 *   theme: gruvboxDark(surfaceColor),
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
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

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
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

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
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

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
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

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

// ─── One Dark ────────────────────────────────────────────────────────────────
// Atom / VS Code lineage — warm gray fg, gold dirs, soft green exes, coral errors.
// Palette aligned with common editor One Dark syntax colours (ANSI mapping).
export function oneDark(background = "#1e1e1e"): ITheme {
	return {
		background,
		foreground:          "#abb2bf",
		cursor:              "#abb2bf",
		cursorAccent:        "#000000",
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

		black:         "#1e1e1e",
		red:           "#e06c75",
		green:         "#98c379",
		yellow:        "#e5c07b",
		blue:          "#61afef",
		magenta:       "#c678dd",
		cyan:          "#56b6c2",
		white:         "#abb2bf",

		brightBlack:   "#5c6370",
		brightRed:     "#be5046",
		brightGreen:   "#98c379",
		brightYellow:  "#e5c07b",
		brightBlue:    "#61afef",
		brightMagenta: "#c678dd",
		brightCyan:    "#56b6c2",
		brightWhite:   "#abb2bf",
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
		selectionBackground: DARK_SELECTION_BG,
		selectionForeground: DARK_SELECTION_FG,

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

// ═══════════════════════════════════════════════════════════════════════════
// Light variants — dark text on light surfaces
// ═══════════════════════════════════════════════════════════════════════════

// ─── Gruvbox Light ───────────────────────────────────────────────────────────
// https://github.com/morhetz/gruvbox (light palette)
export function gruvboxLight(background = "#fbf1c7"): ITheme {
	return {
		background,
		foreground:          "#3c3836", // fg1
		cursor:              "#3c3836",
		cursorAccent:        "#fbf1c7",
		selectionBackground: "#d5c4a155",
		selectionForeground: "#000000",

		black:         "#fbf1c7", // bg
		red:           "#cc241d",
		green:         "#79740e",
		yellow:        "#b57614",
		blue:          "#076678",
		magenta:       "#8f3f71",
		cyan:          "#427b58",
		white:         "#3c3836", // fg1

		brightBlack:   "#928374", // gray
		brightRed:     "#9d0006",
		brightGreen:   "#79740e",
		brightYellow:  "#b57614",
		brightBlue:    "#076678",
		brightMagenta: "#8f3f71",
		brightCyan:    "#427b58",
		brightWhite:   "#282828", // fg0
	};
}

// ─── Solarized Light ─────────────────────────────────────────────────────────
// https://github.com/altercation/solarized (light palette)
export function solarizedLight(background = "#fdf6e3"): ITheme {
	return {
		background,
		foreground:          "#657b83", // base00
		cursor:              "#657b83",
		cursorAccent:        "#fdf6e3",
		selectionBackground: "#eee8d580",
		selectionForeground: "#000000",

		black:         "#eee8d5", // base2
		red:           "#dc322f",
		green:         "#859900",
		yellow:        "#b58900",
		blue:          "#268bd2",
		magenta:       "#d33682",
		cyan:          "#2aa198",
		white:         "#073642", // base02

		brightBlack:   "#93a1a1", // base1
		brightRed:     "#cb4b16", // orange
		brightGreen:   "#586e75", // base01
		brightYellow:  "#657b83", // base00
		brightBlue:    "#839496", // base0
		brightMagenta: "#6c71c4", // violet
		brightCyan:    "#93a1a1", // base1
		brightWhite:   "#002b36", // base03
	};
}

// ─── One Light ───────────────────────────────────────────────────────────────
// Atom One Light palette — dark foreground, muted ANSI, gold dirs.
export function oneLight(background = "#fafafa"): ITheme {
	return {
		background,
		foreground:          "#383a42",
		cursor:              "#383a42",
		cursorAccent:        "#fafafa",
		selectionBackground: "#bfceff77",
		selectionForeground: "#000000",

		black:         "#fafafa",
		red:           "#e45649",
		green:         "#50a14f",
		yellow:        "#c18401",
		blue:          "#4078f2",
		magenta:       "#a626a4",
		cyan:          "#0184bc",
		white:         "#383a42",

		brightBlack:   "#a0a1a7",
		brightRed:     "#e45649",
		brightGreen:   "#50a14f",
		brightYellow:  "#c18401",
		brightBlue:    "#4078f2",
		brightMagenta: "#a626a4",
		brightCyan:    "#0184bc",
		brightWhite:   "#090a0b",
	};
}
