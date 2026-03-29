import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import type { Extension } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Extension → language id
// ---------------------------------------------------------------------------

const EXT_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",
  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  // Data / config
  json: "json",
  jsonc: "json",
  toml: "text",
  yaml: "text",
  yml: "text",
  // Prose
  md: "markdown",
  mdx: "markdown",
  txt: "text",
  // Systems
  rs: "rust",
  c: "text",
  cpp: "text",
  h: "text",
  hpp: "text",
  go: "text",
  java: "text",
  // Scripting
  py: "python",
  sh: "text",
  bash: "text",
  zsh: "text",
  fish: "text",
  // SQL
  sql: "text",
};

/** Derive a language id from a filename. Falls back to "text". */
export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "text";
}

/** Return the display label for a language id (for the status bar). */
export function languageLabel(lang: string): string {
  const labels: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    markdown: "Markdown",
    rust: "Rust",
    python: "Python",
    text: "Plain Text",
  };
  return labels[lang] ?? lang;
}

// ---------------------------------------------------------------------------
// Language → CodeMirror Extension
// ---------------------------------------------------------------------------

/** Return the CodeMirror language extension for a language id. */
export function getLanguageExtension(lang: string): Extension[] {
  switch (lang) {
    case "typescript":
      return [javascript({ typescript: true, jsx: true })];
    case "javascript":
      return [javascript({ jsx: true })];
    case "json":
      return [json()];
    case "markdown":
      return [markdown()];
    case "rust":
      return [rust()];
    case "python":
      return [python()];
    case "html":
      return [html()];
    case "css":
      return [css()];
    default:
      return [];
  }
}
