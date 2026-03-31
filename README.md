<div align="center">

<br />

# Blackslate

**The terminal built for the agentic developer.**

A macOS terminal that works like every great terminal you've used — fast, minimal, out of the way. Then Claude Code starts, and everything changes.

<br />

[![macOS](https://img.shields.io/badge/macOS-13%2B-000000?style=flat-square&logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

<br />

<img src="screenshots/main-terminal.png" alt="Blackslate — terminal workspace" width="100%" />

<img src="screenshots/main-claude.png" alt="Blackslate — Claude Code active with title bar token usage and session controls" width="100%" />

<img src="screenshots/codereview.png" alt="Blackslate — git diff viewer for your changes" width="100%" />

<img src="screenshots/resumeclaudesessions.png" alt="Blackslate — resume Claude Code sessions from the UI" width="100%" />

<img src="screenshots/sills-commands-hooks.png" alt="Blackslate — browse Claude skills, commands, and hooks" width="100%" />

<img src="screenshots/themeconfig.png" alt="Blackslate — terminal theme and preferences" width="100%" />

<br />

</div>

---

> **Active development** — Blackslate is evolving quickly. **Expect breaking changes** (APIs, shortcuts, storage, and UI) between releases until things stabilise. **Pull requests are welcome.**

---

## The problem

Every terminal treats the agent as just another process printing to a pipe. You spawn Claude Code, it starts working, and now you're lost — scrolling back through walls of output trying to remember which session is doing what, what files it touched, where it is in the task, which directory that was.

The tools are powerful. The workspace isn't built for them.

---

## What Blackslate does

Blackslate wraps the terminal in an intelligent workspace layer. It doesn't replace the shell — it reads it. When Claude Code is running, the UI surfaces what matters: usage and session controls in the title bar, which workspace and tab is active, git and diffs beside your work, and a live picture of the agent. No more hunting through tabs.

The philosophy is deliberate: **augment at the UI/UX layer, not at the protocol layer.** PTY, shell, and process management are solved problems. The unsolved problem is the experience of working *alongside* an agent — and that's entirely a UI/UX problem.

---

## Vision

Blackslate's near-term goal is the best Claude Code–native terminal on macOS.

The longer-term goal is bigger: **a full-stack developer workspace that lives inside the terminal.** An integrated code editor, a **Claude events timeline**, splits, composer + model controls, and git actions — everything you need to run a complete read–edit–run loop without ever leaving the surface where the agent is working. Not Electron. Not a browser tab. A native macOS application built from the ground up for the workflow that's actually happening in 2025.

---

## Features

### Title bar & usage

- **Token usage** — after each Claude Code turn, **input** and **output** token counts appear at the **top right** of the title bar; hover for cache read/write and full detail

### Git & code review

- **Diff viewer** — open your **Changes** / **Staged** files in a full **code diff** view so you can review what you (and the agent) touched before you commit (**`⌘L`** toggles the git panel)

### Claude in the workspace

- **Tab & workspace indicators** — see at a glance where Claude Code is running: indicators on **horizontal tabs** and **workspace** rows in the sidebar
- **Claude Code detection** — Blackslate polls the PTY's foreground process group and walks the shell's process tree to detect when `claude` is running

### Workspaces & tabs

- **Multiple workspaces** — each workspace is a row in the sidebar; **`⌘1`–`⌘9`** jumps to workspace 1–9 in order
- **Multiple tabs per workspace** — several terminal sessions inside one workspace; **`⌘⌥1`–`⌘⌥9`** selects tab 1–9, **`⌘[`** / **`⌘]`** previous or next tab (wraps)
- **Rename** — rename **workspaces** and **terminal tabs** inline so long-running sessions stay identifiable
- **PTYs stay alive** — every tab keeps its own PTY; inactive tabs stay mounted so switching is instant with no shell state loss

### Resume Claude sessions

- **Session picker** — browse past Claude Code conversations from the header and **resume** one with a click; Blackslate sends the right `/resume` or `claude --resume` input to the active PTY

### Claude toolkit (skills, commands, hooks)

- **In-terminal UI** — inspect your **skills**, **slash commands**, and **hooks** in a structured, readable layout without leaving Blackslate

### Git changes pane

- **Right-side git panel** — track multiple repositories, see **Changes** / **Staged** per repo, line stats, and stage or discard from the UI (**`⌘L`** toggles the panel)
- **Branch and status** — current branch per repo via `git`; status is polled while the panel is open

### Terminal

- **WebGL-accelerated rendering** — xterm.js with the WebGL backend, the same renderer powering VS Code's integrated terminal
- **Live cwd tracking** — OSC 7 shell integration injected automatically via `ZDOTDIR` (zsh) and `PROMPT_COMMAND` (bash), without touching your dotfiles
- **Git awareness in the sidebar** — branch name per session when the cwd is inside a repo
- **Project stack detection** — Rust, Go, Node, React, Python and more detected from project files and shown as badges per session
- **Font size control** — `⌘=` / `⌘-` resize live across all sessions

### Keyboard shortcuts

Global shortcuts use **⌘** on macOS (shown below). On other platforms the same actions use **Ctrl** where applicable.

| Shortcut | Action |
|----------|--------|
| `⌘,` | Open **Settings** (terminal theme, sidebar colour, font size) |
| `⌘N` | New workspace |
| `⌘T` | New tab in the active workspace |
| `⌘W` or `⌘Q` | Close active tab (with confirm when the session has work in progress) |
| `⌘⇧W` | Close the **active workspace** (with confirm when needed) |
| `⌘⇧Q` | **Quit** Blackslate (from the app menu; frees `⌘Q` for close-tab) |
| `⌘R` | Rename the **active tab** |
| `⌘⇧R` | Rename the **active workspace** |
| `⌘1`–`⌘9` | Switch to workspace **1–9** (sidebar order) |
| `⌘⌥1`–`⌘⌥9` | Switch to tab **1–9** in the active workspace |
| `⌘[` / `⌘]` | Previous / next tab in the active workspace (wraps) |
| `⌘B` | Toggle sidebar |
| `⌘L` | Toggle git changes pane |
| `⌘=` / `⌘-` | Zoom terminal font in / out (main keyboard; **numpad +** / **numpad −** also work) |

Also: **Blackslate → Settings…** in the menu bar.

### Agent Workspace

- **Persistent session sidebar** — directory, full path, git branch, dirty status, and project stack at a glance for every open session
- **Session persistence** — inactive sessions stay mounted with `visibility: hidden`; the PTY keeps running, scroll history is intact, no reconnection on switch

### Personalisation

- **Terminal themes** (xterm palette, live preview in Settings) — **Gruvbox Dark**, **Tokyo Night**, **Dracula**, **Nord**, **Solarized Dark** — switch anytime via **`⌘,`**
- **Sidebar colours** — ten dark palettes (**Void**, **Carbon**, **Ember**, **Aurora**, **Deep Sea**, **Toxic**, **Dusk**, **Crimson**, **Rose**, **Slate**) tuned to sit next to the terminal
- Deeper preferences will move toward **`blackslate.config`** and file-based settings (see roadmap)

### Roadmap & priorities

Planned work below is **not** shipped yet unless called out elsewhere in this README. Order reflects current intent; **test coverage** is the top priority.

#### Foundation

| Priority | Feature |
|:---:|:---|
| **1** | **Test coverage** — automated tests across the Rust backend (PTY, git, process helpers) and the React/TypeScript frontend (stores, hooks, critical UI). Goal: safe refactors and regression protection as the surface area grows. |
| **2** | **`blackslate.config`** — a single, user-owned config file so behaviour that is today scattered (or only in the UI) becomes **fully configurable**: shortcuts, defaults, feature flags, paths, and anything else we expose over time. |
| **3** | **Restore workspace on reopen** — persist the **current workspace layout** (workspaces, tabs, ordering, active selection) so after quit and relaunch you pick up where you left off. (Live PTY sessions themselves are not restored—only layout and metadata.) |

#### Layout & terminals

| | Feature |
|---|---|
| 🔲 | **Reorder workspaces and tabs** — drag-and-drop (or equivalent) to change sidebar and tab order |
| 🔲 | **Vertical split terminal** — two terminals stacked in one pane |
| 🔲 | **Horizontal split terminal** — two terminals side by side |

#### Claude, composer & git

| | Feature |
|---|---|
| 🔲 | **Message composer + model selection** — first-class UI for composing input and choosing the Claude model in context |
| 🔲 | **Claude events timeline** — structured feed of agent-visible events (tool use, lifecycle, file touchpoints) alongside the scrollback |
| 🔲 | **Commit and push** — dedicated actions from the git UI to commit and push without leaving Blackslate |

#### Further out

| | Feature |
|---|---|
| 🔲 | **Integrated code editor** — edit files inside Blackslate so the read–edit–run loop can stay in one window |

---

## Tech stack

| Layer | Technology |
|---|---|
| Application shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Terminal renderer | xterm.js + WebGL addon |
| State | Zustand |
| PTY backend | portable-pty (Rust) |
| Async runtime | Tokio |
| Process detection | macOS `proc_pidinfo` / `sysinfo` |

The Rust backend is infrastructure only — PTY lifecycle, process detection, git and project metadata. All parsing, state, and UX logic lives in the React frontend. Blackslate makes no Anthropic API calls; it reads Claude Code's output from the PTY stream.

---

## Getting started

### Prerequisites

- macOS 13 or later
- [Rust](https://rustup.rs) stable toolchain
- [Bun](https://bun.sh) (or Node.js 20+)
- Xcode Command Line Tools: `xcode-select --install`

### Clone the repository

```bash
git clone https://github.com/your-org/blackslate.git
cd blackslate
```

### Build instructions

**Install dependencies**

```bash
bun install
```

**Run locally** — development build with hot reload (Vite + Tauri). The first run compiles the Rust backend (about a minute); later runs are incremental.

```bash
bun tauri dev
```

**Create a release build** — produces the macOS `.app` and a `.dmg` installer (artifacts under `src-tauri/target/release/bundle/`).

```bash
bun tauri build
```

---

## Project structure

```
blackslate/
├── src/                           # React frontend
│   ├── components/
│   │   ├── layout/                # AppLayout — titlebar, sidebar, main pane
│   │   ├── sidebar/               # AppSidebar — session list + metadata
│   │   ├── terminal/              # TerminalPane, TerminalView
│   │   └── settings/              # SettingsDialog
│   ├── hooks/
│   │   └── usePty.ts              # PTY ↔ xterm.js bridge + OSC 7 parser
│   ├── store/
│   │   ├── sessions.ts            # Zustand session store
│   │   └── settings.ts            # Preferences — theme, sidebar colour, font
│   └── lib/
│       ├── terminalThemes.ts      # xterm.js colour theme definitions
│       └── appShortcuts.ts        # Global keyboard shortcut registry
│
└── src-tauri/src/                 # Rust backend
    └── terminal/
        ├── session/               # PtySession, shell cmd builder, PTY reader task
        ├── manager.rs             # SessionManager — RwLock concurrent map
        ├── commands/              # Tauri IPC command handlers
        └── agent_detect/          # Claude Code process-tree detection
```

---

## Architecture notes

**Shell integration without dotfile mutation** — OSC 7 cwd reporting is injected at session creation via a temporary `ZDOTDIR` override (zsh) and a `PROMPT_COMMAND` prefix (bash). Your dotfiles are never touched.

**Agent detection** — `tcgetpgrp` on the PTY master returns the foreground process group; `sysinfo` walks the tree from the shell PID. Both paths are checked, so detection works whether `claude` is a foreground job or a nested subprocess.

**Event coalescing** — the PTY reader accumulates output for up to 4 ms or 8 KB before emitting a Tauri IPC event. This keeps throughput high during agent output bursts without adding perceptible latency in interactive use.

**No xterm.js unmounting** — all `TerminalPane` instances stay mounted at all times. Inactive sessions are hidden with `visibility: hidden`, so xterm can keep measuring container dimensions via `ResizeObserver`. Switching sessions is instant with no PTY state loss.

**PTY concurrency** — `SessionManager` uses `RwLock<HashMap<String, Arc<PtySession>>>` so writes, resizes, and agent checks across concurrent panes proceed in parallel without contending on a global lock.

---

## Contributing

Issues and **pull requests are welcome**. Because the project is under active development, larger refactors or behaviour changes may land without a long deprecation window—pin to a release or commit if you need stability.

A few hard constraints that keep the architecture clean:

- **xterm.js owns all terminal rendering** — never write terminal output to the React DOM
- **All `TerminalPane` instances stay mounted** — use `visibility: hidden` for inactive sessions, never `display: none`
- **No Anthropic API calls** — Blackslate reads Claude Code's PTY output; it does not call any AI API itself
- **Business logic belongs in the frontend** — the Rust backend is infrastructure only

---

## License

MIT
