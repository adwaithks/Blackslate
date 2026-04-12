# Contributing to Blackslate

Thanks for your interest in contributing! This guide explains how to set up your development environment, our Git workflow, and how to submit changes.

---

## Development Setup

### Prerequisites

- **macOS 13+** (currently macOS-only)
- **[Bun](https://bun.sh)** — used for installs and all `package.json` scripts
- **[Rust](https://rustup.rs)** stable (edition 2021 toolchain)
- **Xcode Command Line Tools** (`xcode-select --install`)

Node.js is not required if you use Bun end-to-end. If you adapt steps to npm, use **Node 20+**.

### Quick Start

```bash
# Clone the repo (folder name matches the GitHub repo)
git clone https://github.com/adwaithks/Blackslate.git
cd Blackslate

# Install dependencies
bun install

# Run the full desktop app (Vite + Tauri / Rust — first compile ~1 min)
bun tauri dev
```

**Frontend only** (no Rust, no native window): `bun run dev` runs Vite on `http://localhost:1420` — useful for UI-only work, not a substitute for PTY or Tauri commands.

**Tests**

```bash
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

In dev, WebView devtools are available with **⌘⌥I** (or **⌘⇧I** depending on platform defaults). DevTools and CSP are configured in `src-tauri/tauri.conf.json`; adjust there if you are preparing a hardened release build.

### Building for Release

```bash
bun tauri build
```

Produces `.app` + `.dmg` under `src-tauri/target/release/bundle/`. Before a public release, maintainers may set `devtools` to `false` (and tighten `csp`) in `tauri.conf.json`.

---

## Git Workflow

The default branch on GitHub is **`main`**. Day-to-day integration happens on **`development`**.

### Branch Structure

```
main (default — stable, release-tagged)
  ↑ merge from development or release/* when ready
development (integration — open PRs here)
  ↑ branch feature/*, fix/*, docs/*, etc.
```

**Rules**

- **`main`** — matches what users building from source typically clone; release tags point here.
- **`development`** — target branch for contributor PRs.
- **Topic branches** — short-lived; branch from `development`.

### Branch Naming

```
feature/short-description
fix/short-description
docs/short-description
refactor/short-description
chore/short-description
```

### Opening a PR

1. `git checkout development && git pull origin development`
2. `git checkout -b feature/your-topic`
3. Commit with [Conventional Commits](#commit-messages) when possible.
4. `git push -u origin feature/your-topic` and open a PR **into `development`**.

Keep up to date with `git fetch origin && git rebase origin/development` if `development` has moved (avoid merge commits unless a maintainer asks).

---

## Commit Messages

**Conventional Commits** keep history readable:

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Scopes (examples):** `terminal`, `pty`, `session`, `git`, `ui`, `theme`, `config`, `build`, `ci`

**Examples**

```
feat(terminal): add session grouping by workspace
fix(pty): handle EOF when the child exits
chore(deps): bump Vite to 7.x
docs(README): clarify rg sidecar setup
```

---

## Testing

### Frontend (Vitest)

```bash
bun run test
bun run test:watch
```

Place tests next to source (e.g. `Foo.tsx` / `Foo.test.tsx` or `*.test.ts`).

### Rust

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### Before Submitting a PR

- `bun run test` passes
- `cargo test --manifest-path src-tauri/Cargo.toml` passes
- `bunx tsc --noEmit` — TypeScript typecheck (same compiler as `bun run build`, without a full Vite production build)
- Manual smoke test for behaviour your change touches (`bun tauri dev`)

---

## Code Style

### TypeScript / React

- TypeScript **strict** mode — fix type errors; do not silence with `any` without a strong reason.
- Match existing formatting and naming in nearby files (no repo-wide ESLint/Prettier scripts yet).

### Rust

```bash
cd src-tauri
cargo fmt
cargo clippy
```

Prefer `Result` over panics in new code; avoid `.unwrap()` on mutex guards where poisoning could crash the app.

---

## Release Process (Maintainers)

### 1. Version bump

Sync version in:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Add a dated section under `[Unreleased]` or the new version in [CHANGELOG.md](CHANGELOG.md), then move items out of Unreleased when you tag.

### 2. Merge to `main`

From `development`, either:

- Open a PR `development` → `main` after CI and macOS smoke (`bun tauri build`, run the app), or
- Use a short-lived `release/x.y.z` branch if you need extra QA before merging to `main`.

### 3. Tag and GitHub Release

```bash
git checkout main
git pull origin main
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

Publish a **GitHub Release** (pre-release for alpha), attach the `.dmg` or document exact build steps.

### 4. Merge back to `development`

```bash
git checkout development
git pull origin development
git merge main
git push origin development
```

---

## Hotfixes (urgent fix on `main`)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/short-name
# commit fix
git push -u origin hotfix/short-name
```

Open PR → `main`, then merge `main` into `development` so both lines stay aligned.

---

## Questions?

- **Bug?** Open an issue with repro steps.
- **Idea?** Open an issue or discussion.
- **Setup?** See [README.md](README.md) and this file.

Thanks for contributing.
