import { gruvboxDark } from "@uiw/codemirror-theme-gruvbox-dark";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { nord } from "@uiw/codemirror-theme-nord";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { TerminalThemeId } from "@/store/settings";

/**
 * Map our terminal theme id to a matching CodeMirror theme extension.
 * Syntax colours come from the theme; backgrounds are overridden to black
 * via blackBgOverride so the editor sits flush in the Blackslate chrome.
 */
export function getEditorTheme(id: TerminalThemeId): Extension {
  switch (id) {
    case "dracula":
      return dracula;
    case "tokyoNight":
      return tokyoNight;
    case "nord":
      return nord;
    case "gruvboxDark":
    default:
      return gruvboxDark;
  }
}

// ---------------------------------------------------------------------------
// File-tree colour palette — keyed to terminal theme
// ---------------------------------------------------------------------------

export interface FileTreePalette {
  folder: string;   // folder icon
  code: string;     // JS / TS / Rust / Go / etc.
  data: string;     // JSON / YAML / TOML / SQL
  markup: string;   // HTML / CSS / SCSS
  prose: string;    // MD / TXT
  default: string;  // catch-all
}

export const FILE_TREE_PALETTES: Record<TerminalThemeId, FileTreePalette> = {
  gruvboxDark: {
    folder:  "#d79921",  // neutral_yellow — warm amber
    code:    "#b8bb26",  // bright_green
    data:    "#8ec07c",  // bright_aqua
    markup:  "#83a598",  // bright_blue
    prose:   "#a89984",  // fg4
    default: "#928374",  // gray
  },
  dracula: {
    folder:  "#f1fa8c",  // yellow
    code:    "#50fa7b",  // green
    data:    "#8be9fd",  // cyan
    markup:  "#bd93f9",  // purple
    prose:   "#6272a4",  // comment
    default: "#6272a4",
  },
  tokyoNight: {
    folder:  "#e0af68",  // yellow
    code:    "#9ece6a",  // green
    data:    "#7dcfff",  // cyan
    markup:  "#7aa2f7",  // blue
    prose:   "#565f89",  // comment
    default: "#565f89",
  },
  nord: {
    folder:  "#ebcb8b",  // nord13 yellow
    code:    "#a3be8c",  // nord14 green
    data:    "#88c0d0",  // nord8 cyan
    markup:  "#81a1c1",  // nord9 blue
    prose:   "#4c566a",  // nord3
    default: "#4c566a",
  },
};

export function getFileTreePalette(id: TerminalThemeId): FileTreePalette {
  return FILE_TREE_PALETTES[id];
}

/**
 * Forces the editor canvas and gutters to pitch black, overriding whatever
 * background the chosen theme would normally set. Applies after the theme
 * extension so it always wins. Syntax highlighting is unaffected.
 */
export const blackBgOverride: Extension = EditorView.theme({
  // Editor canvas
  "&":                    { backgroundColor: "#000 !important" },
  "&.cm-focused":         { outline: "none" },
  // Line gutter (line numbers column)
  ".cm-gutters":          {
    backgroundColor: "#000 !important",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.2)",
  },
  // Highlight for the line the cursor is on
  ".cm-activeLine":       { backgroundColor: "rgba(255,255,255,0.03) !important" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.03) !important" },
  // Search match highlight — keep visible against black
  ".cm-selectionMatch":   { backgroundColor: "rgba(255,255,255,0.08)" },
});
