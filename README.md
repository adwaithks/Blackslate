# Slate

**The terminal built for the agentic developer.**

Slate is a macOS terminal that works like any great native terminal — fast, minimal, out of the way. The difference becomes visible the moment Claude Code starts running inside it. Slate detects the agent, reorganises the workspace around it, and surfaces context that would otherwise be buried in scrollback.

The longer-term vision goes further: a first-class code editor that lives inside the terminal itself, so the read-edit-run loop never requires you to leave the surface where the agent is working.

> macOS only. No cross-platform abstractions.

---

## Why Slate

Every existing terminal treats the agent as just another process printing to a pipe. Slate is designed from the ground up around the reality that the terminal is increasingly where agents live and where developers spend most of their time when building with AI.

The philosophy is deliberate: **don't reinvent the terminal — augment it at the UI/UX layer**. The PTY, shell, and process management are solved problems. What isn't solved is the experience of working *alongside* an agent in that environment — tracking what it's doing, seeing what files it's touching, understanding where it is in a task, and switching fluidly between guiding the agent and writing code yourself.

Slate is that layer.

---

## Features

### Terminal

- **WebGL-accelerated rendering** via xterm.js — the same renderer powering VS Code's terminal
- **Multiple sessions** with a persistent sidebar — each session has its own PTY; switching is instant with zero shell state loss
- **Live cwd tracking** — OSC 7 shell integration injected automatically via `ZDOTDIR` (zsh) and `PROMPT_COMMAND` (bash), without touching user dotfiles
- **Git status** — branch name and dirty indicator per session, branch read directly from `.git/HEAD` with no subprocess overhead
- **Project stack detection** — Rust, Go, Node, React, Python detected from project files and shown as context badges per session
- **Font size zoom** — `⌘=` / `⌘-` resize the terminal live across all sessions
- **Keyboard shortcuts** — `⌘N` new session, `⌘W` close session, `⌘1`–`⌘9` switch sessions, `⌘B` toggle sidebar

### Agent Workspace

- **Claude Code detection** — Slate polls the PTY's foreground process group and walks the shell's process tree to detect when `claude` is running, displayed as a live indicator per session
- **Session sidebar** — directory name, full path, git branch, dirty status, and project stack visible at a glance for every open session

### On the Roadmap

- **Inline diff viewer** — file edits rendered as side-by-side diffs without leaving the terminal
- **Agent action timeline** — structured feed of tool calls and file operations as Claude Code works
- **Integrated code editor** — edit files directly inside Slate; the read-edit-run loop never requires switching to another application
- **Agent status bar** — thinking / running tool / waiting for input surfaced as first-class UI
- **Pane splits** — vertical and horizontal splits, multiple terminals in one window

---

## Design Principles

**Native feel first.** Default mode is a fast, minimal terminal. No visual noise, no lag, nothing unfamiliar to a developer used to iTerm2 or Ghostty.

**Transformation, not decoration.** The UI changes meaningfully when an agent is running. It doesn't just add decorations to a dumb pipe — it reorganises the workspace around the agent's work loop.

**High information density.** Developers aren't afraid of dense interfaces. Slate doesn't over-space or hide context behind extra clicks.

**Subtle motion only.** Transitions exist to reduce cognitive load, never to draw attention. The terminal itself is never animated.

**Dark first.** Light mode is not a priority.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Native shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Terminal renderer | xterm.js + WebGL addon |
| State management | Zustand |
| PTY backend | portable-pty (Rust) |
| Async runtime | Tokio |
| Process detection | sysinfo |

The Rust backend is infrastructure only — PTY lifecycle, process detection, git and project metadata. All parsing, state, and UX logic lives in the React frontend. Slate makes no Anthropic API calls; it reads Claude Code's output from the PTY stream.

---

## Getting Started

### Prerequisites

- macOS 13 or later
- [Rust](https://rustup.rs) stable toolchain
- [Bun](https://bun.sh) (or Node.js 20+)
- Xcode Command Line Tools — `xcode-select --install`

### Build from Source

```bash
git clone https://github.com/your-org/slate.git
cd slate

bun install          # install frontend dependencies
bun tauri dev        # development server with hot reload
```

The first run compiles the Rust backend, which takes a minute or two. Subsequent runs are incremental.

```bash
bun tauri build      # production .app + .dmg
```

---

## Project Structure

```
slate/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/               # AppLayout — titlebar, sidebar, main area
│   │   ├── sidebar/              # AppSidebar — session list with metadata
│   │   └── terminal/             # TerminalPane, TerminalView
│   ├── hooks/
│   │   └── usePty.ts             # PTY ↔ xterm bridge, OSC 7 cwd parser
│   ├── store/
│   │   ├── sessions.ts           # Zustand session store
│   │   └── settings.ts           # Font size and user preferences
│   └── lib/
│       ├── appShortcuts.ts       # Global keyboard shortcut system
│       └── projectStack.tsx      # Stack icons and display ordering
│
└── src-tauri/src/                # Rust backend
    └── terminal/
        ├── session.rs            # PtySession — spawn, read, write, resize
        ├── manager.rs            # SessionManager — Arc<RwLock> concurrent map
        ├── commands.rs           # Tauri IPC command handlers
        ├── agent_detect.rs       # Claude Code process-tree detection
        └── project_stack.rs      # Project file detection (Cargo.toml, go.mod, …)
```

---

## Architecture Notes

**PTY concurrency** — `SessionManager` uses `RwLock<HashMap<String, Arc<PtySession>>>` so writes, resizes, and agent checks across concurrent panes proceed in parallel without contending on a global lock.

**Shell integration** — OSC 7 cwd reporting is injected at session creation via a temporary `ZDOTDIR` override for zsh and a `PROMPT_COMMAND` prefix for bash. User dotfiles are never modified.

**Agent detection** — `tcgetpgrp` on the PTY master provides the foreground process group; `sysinfo` walks the tree from the shell PID. Both paths are checked, so detection works whether `claude` is a foreground job or a background subprocess.

**Event coalescing** — the PTY reader accumulates output for up to 4 ms or 8 KB before emitting a Tauri IPC event. This keeps throughput high during agent output bursts without adding perceptible latency in interactive use.

**No xterm.js unmounting** — all `TerminalPane` instances stay mounted at all times. Inactive sessions are hidden with `visibility: hidden` rather than `display: none`, so xterm can still measure container dimensions via `ResizeObserver`. Switching sessions is instant with no PTY state loss.

---

## Contributing

Slate is in active early development. Issues and pull requests are welcome.

A few hard rules that keep the architecture clean:

- xterm.js owns all terminal rendering — never write terminal output to the React DOM
- All `TerminalPane` instances must stay mounted; use `visibility: hidden` for inactive sessions
- No Anthropic API calls from Slate — it reads Claude Code's PTY output, it does not call any AI API itself
- Business logic belongs in the frontend; the Rust backend is infrastructure only

---

## License

MIT
