# Blackslate v1.0 roadmap

This document is the **release plan for v1.0**: what we ship first, **why users care**, and enough implementation context for contributors. It is separate from the long product vision in the README.

---

## Principles

1. **Users first** — Prioritise things that prevent daily frustration (lost sessions, opaque behaviour) over polish that only matters in demos.
2. **OSS-friendly** — Anyone can **build from source** and run Blackslate without waiting for maintainers. A **v1.0 tag** does not depend on Apple notarisation or a paid developer programme.
3. **Honest macOS reality** — **Auto-updates** and **frictionless DMG installs** on macOS work best with **code signing + notarisation**. We treat that as a **phased goal**: ship value first, then harden distribution.

---

## Current codebase baseline

Snapshot of the repo **as of the v1 planning pass** — use this to avoid duplicating work or drifting from what already exists.

| Area | Today | v1 target |
|:-----|:------|:----------|
| **App version** | `0.1.0` in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json` — should stay **in sync** when tagging releases | `1.0.0` at v1 tag; single source of truth wired into the UI |
| **Workspaces / tabs** | Zustand in `src/store/sessionsStore.ts`; `src/store/sessionsTypes.ts` documents layout as **not persisted** (in-memory + PTY wiring via `usePty`) | Versioned on-disk snapshot + hydrate on launch; new PTY per tab with saved `cwd` |
| **Appearance prefs** | Zustand `persist` → **localStorage** key `blackslate-settings` (`src/store/appConfig.ts`) — terminal theme, app chrome theme, font size | Either fold into the same app-data snapshot as layout, or document explicit **merge order** vs file config so nothing fights |
| **Other persisted UI** | `gitRepos` store (localStorage); git panel / resizable widths (localStorage keys) | Keep as-is or migrate paths once; ensure restore story does not assume WebView localStorage is the only durable store |

**Risks to address when implementing restore**

- **Split brain** — If layout lives in `~/Library/...` JSON but themes stay only in localStorage, reinstalls or cleared WebView storage can reset appearance while “restoring” tabs, or vice versa. Prefer **one authoritative persistence layer** for user state, or a documented migration + precedence rule.
- **Invalid `cwd`** after restore (moved/deleted dirs) — define fallback (e.g. home) and user-visible notice (see P2).

**Primary touchpoints for workspace restore**

- `src/store/sessionsStore.ts`, `src/store/sessionsTypes.ts` — serialize/hydrate boundaries; omit ephemeral fields (`ptyId`, live Claude state, etc.).
- `src/hooks/usePty.ts` (and session creation paths) — spawn PTYs with saved working directories after hydrate.
- `src-tauri` — `app_data_dir` (or equivalent), optional **atomic write** helpers for the snapshot file.
- Tauri **window close / app exit** hooks — flush snapshot in addition to debounced saves.

---

## P0 — Must ship before we call it v1.0

These are non-negotiable for a credible “1.0” for people who actually use the app every day.

### 1. Restore workspace when the window closes

| | |
|:---|:---|
| **Why users care** | Losing workspaces, tab names, and working directories after quit or crash feels broken compared to every serious terminal. For Claude Code workflows, tabs often map to tasks or repos — rebuilding that by hand is costly. |
| **What “restore” means for v1** | Persist **workspaces**, **tabs**, **order**, **active workspace/tab**, **display names**, **cwd per tab**, and **font size** (and any other single source of truth already in app config, e.g. terminal/UI theme ids if they live in the same store). Reopen shells **in those directories** with **new PTY sessions** — not replay of scrollback or resurrecting in-flight processes. |
| **What we are not promising in v1** | Full **PTY snapshot** (running `claude`, half-typed input, buffer history). That is a different product surface. |
| **Implementation notes** | **Versioned snapshot** (e.g. `schemaVersion` in JSON) under the app data directory; **save on window close / app quit** and **debounced saves** on meaningful changes so force-quit loses less data; **migrate** old shapes on read. Frontend-owned layout state (Zustand) is the natural owner; Tauri can expose **paths** and optional **atomic write** helpers. On restore, create one PTY per saved tab with the saved `cwd` and apply saved names. |

### 2. Manual QA + meaningful test coverage

| | |
|:---|:---|
| **Why users care** | Regressions in PTY, git panel, Claude detection, or persistence erode trust faster than missing features. |
| **What we ship** | A short **manual test checklist** (first launch, restore after quit, multi-workspace/tab, git panel, settings, light/dark themes, skills/commands sheet). **Automated tests** where they pay off: Zustand stores, pure parsers, and small Rust units — expand incrementally; no need to block v1 on a coverage percentage. |
| **Implementation notes** | Keep the checklist in-repo (e.g. `docs/MANUAL_QA.md` or a section here). Prefer tests that lock **behaviour users depend on** (session model, persistence migration, git/repo state helpers) over snapshotting entire UI trees. Existing patterns: `src/store/tests/appConfig.test.ts`, `src/store/tests/gitRepos.test.ts`, and `src/test/stubZustandPersistEnv.ts` for Zustand `persist` under Vitest. |

---

## P1 — High priority (v1.0 or immediately after the tag)

These directly affect **customisation without rebuilds**, **trust in what you installed**, and **how most people get updates**.

### 3. `blackslate.config`

| | |
|:---|:---|
| **Why users care** | Claude Code, paths, and conventions **change over time**. A plain config file lets users adjust defaults (paths, flags, optional command templates) **without a new Blackslate release** and without forking. |
| **What we ship in v1** | A **single documented file** in a fixed location (e.g. under `~/Library/Application Support/Blackslate/` or `~/.config/blackslate/`), **TOML or JSON** — pick one and stay consistent. Start with a **small, high-leverage key set**: things that are likely to need tuning when upstream changes (e.g. path overrides, feature toggles, default shell/cwd behaviour if applicable). **Merge order** documented: config file vs persisted UI state vs defaults. |
| **Implementation notes** | Rust reads the file at startup (and optionally watches for changes) and passes resolved values to the frontend, **or** exposes a `read_config` command; validate unknown keys without crashing; **schema version** inside the file for future migrations. |

### 4. Release hygiene

| | |
|:---|:---|
| **Why users care** | People need to know **what version** they run, **what changed**, and whether a binary matches a **tag**. That matters for bug reports and for “should I upgrade?”. |
| **What we ship** | **Semantic versioning**; **CHANGELOG** following [Keep a Changelog](https://keepachangelog.com/); **Git tags** aligned with releases; **GitHub Releases** with clear notes; **visible app version** (About, title bar, or settings). |
| **Implementation notes** | Wire version from `tauri.conf.json` / `Cargo.toml` into the UI once; keep **`package.json` `version` aligned** with the Tauri app version for tooling and clarity. Add a CI check or release script if helpful. Automate release notes from tags if helpful later. |

### 5. Prebuilt macOS artifacts and auto-updates (phased)

| | |
|:---|:---|
| **Why users care** | Most users **will not** compile Rust. Downloadable builds and **in-app or Tauri-driven updates** mean bugfixes reach them quickly. |
| **OSS / v1 stance** | **v1.0 is not blocked** on maintainers shipping a notarised DMG: **building from source remains first-class**. We still **want** official **DMG (and/or app bundle) on GitHub Releases** and **Tauri updater** wired so users who install a binary get updates. |
| **Phasing** | **Phase A** — CI or manual attach **unsigned** (or ad-hoc signed) `.dmg` / `.app.tar.gz` to GitHub Releases; document Gatekeeper / right-click open. **Phase B** — **Apple Developer ID + notarisation** so Gatekeeper and **updater** behave like normal Mac software; enable Tauri updater endpoints and signing in CI. |
| **Implementation notes** | Tauri 2 **updater** + hosted update JSON; signing secrets only in CI, not in the repo. Document in README: “Source install”, “Release binary (unsigned)”, “Release binary (signed)” when Phase B exists. |

---

## P2 — Strongly recommended before “wide” promotion

Not strictly required to tag v1.0, but they reduce support load when strangers start installing.

| Item | Why |
|:-----|:----|
| **First-run / empty state** | Clear copy when there are no workspaces, or persistence failed — avoids “is it broken?” |
| **Persistence failure UX** | If the snapshot is corrupt, **fall back** safely and tell the user once. |
| **Documented limitations** | e.g. non-login shell / `.zprofile` — matches real behaviour so expectations are fair. |

---

## Out of scope for v1.0

- Terminal **splits**, drag-and-drop **reorder**, **composer**, **Claude event timeline**, **integrated editor** — see README vision; these stay post-v1 unless reprioritised.
- **Perfect** macOS auto-update experience **without** signing — not realistic; we document Phase A vs Phase B instead.

---

## Post-v1 backlog (reference)

| Area | Examples |
|:-----|:---------|
| Layout | Tab/workspace reorder, vertical/horizontal splits |
| Claude | Message composer, model selection, events timeline |
| Git | Commit / push from UI |
| Editor | In-terminal read–edit–run loop |

---

## Suggested sequencing (implementation)

Order is a guide, not a contract — parallelise where it makes sense.

1. **Workspace snapshot schema + disk I/O** (P0.1) — defines what tests and UI hydrate against.
2. **Hydrate store + PTY creation with saved `cwd`** (P0.1) — end-to-end restore.
3. **Automated tests + manual QA doc** (P0.2) — lock migrations and session shape; expand Rust units as helpers land.
4. **Release hygiene** (P1.4) — visible version, CHANGELOG, tags; low dependency on restore.
5. **`blackslate.config`** (P1.3) — after or alongside restore; **document merge order** vs snapshot and localStorage-backed prefs.
6. **GitHub Release artifacts** (P1.5 Phase A), then **signing + updater** (Phase B) when maintainers can support it.
7. **P2** polish before heavy public promotion; persistence-failure UX depends on P0.1 being in place.

---

## Summary

| Priority | Theme | Outcome for users |
|:--------:|:------|:------------------|
| **P0** | Restore + quality | Quitting the app doesn’t destroy your workspace; fewer surprise regressions. |
| **P1** | Config + releases + binaries | Tune behaviour without rebuilds; know what you installed; optional download + update path (improving with signing). |
| **P2** | Polish | Fewer confused issues when the public tries the app. |

When P0 and P1 are in a state we’re proud of, we tag **v1.0** — with **source-first** always valid, and **release binaries + updater** improving from Phase A → Phase B as maintainers can support signing.
