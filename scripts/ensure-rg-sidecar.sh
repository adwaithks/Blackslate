#!/usr/bin/env bash
# Run before Vite build so `tauri build` (beforeBuildCommand) finds rg in src-tauri/binaries/.
# No-op on non-macOS — frontend-only builds on Linux CI skip the download.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(uname -s)" in
Darwin)
	TRIPLE="$(rustc --print host-tuple 2>/dev/null || true)"
	if [[ -n "$TRIPLE" && -f "$ROOT/src-tauri/binaries/rg-$TRIPLE" ]]; then
		echo "ensure-rg-sidecar: rg-$TRIPLE already present, skipping download"
		exit 0
	fi
	exec bash "$ROOT/scripts/download-rg-sidecar.sh"
	;;
*)
	echo "ensure-rg-sidecar: skipping (not macOS); wiki sidecar is only bundled on Mac targets."
	exit 0
	;;
esac
