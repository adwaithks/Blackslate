# Bundled sidecars

## `rg` (ripgrep)

Tauri bundles `binaries/rg` per macOS target triple (see [`tauri.conf.json`](../tauri.conf.json) `bundle.externalBin`).

For local builds you need a file named:

| Platform    | Filename                    |
|-------------|-----------------------------|
| macOS ARM64 | `rg-aarch64-apple-darwin`   |
| macOS Intel | `rg-x86_64-apple-darwin`    |

### Setup (macOS)

From the repo root:

```bash
chmod +x scripts/download-rg-sidecar.sh
./scripts/download-rg-sidecar.sh
```

Optional: `RG_VERSION=14.1.1 ./scripts/download-rg-sidecar.sh` (default is 14.1.1).

These binaries are gitignored; CI should run the download script before `tauri build`.

### `tauri dev`

The app loads the sidecar from `target/debug/binaries/rg` (next to the dev executable). After you run `setup:rg`, **`cargo build` / `bun tauri dev`** copies `binaries/rg-<triple>` there automatically via `build.rs`. If the wiki picker still errors, run a clean build once (`cargo clean` in `src-tauri`, then `bun tauri dev`).
