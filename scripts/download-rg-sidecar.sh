#!/usr/bin/env bash
# Download ripgrep release binary for the current host and install as a Tauri sidecar
# (see src-tauri/binaries/README.md).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$ROOT/src-tauri/binaries"
VERSION="${RG_VERSION:-14.1.1}"

mkdir -p "$DEST_DIR"

TRIPLE="$(rustc --print host-tuple 2>/dev/null || true)"
if [[ -z "$TRIPLE" ]]; then
	echo "error: could not run \`rustc --print host-tuple\`; install Rust or set TRIPLE manually" >&2
	exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"

case "$TRIPLE" in
aarch64-apple-darwin | x86_64-apple-darwin)
	ARCHIVE="ripgrep-${VERSION}-${TRIPLE}.tar.gz"
	curl -fsSL -o "$ARCHIVE" \
		"https://github.com/BurntSushi/ripgrep/releases/download/${VERSION}/${ARCHIVE}"
	tar -xzf "$ARCHIVE"
	install -m0755 "./ripgrep-${VERSION}-${TRIPLE}/rg" "$DEST_DIR/rg-${TRIPLE}"
	;;
*)
	echo "error: Blackslate only bundles rg for macOS (aarch64-apple-darwin or x86_64-apple-darwin)." >&2
	echo "This machine reports: ${TRIPLE:-unknown}" >&2
	exit 1
	;;
esac

echo "Installed rg sidecar for $TRIPLE (ripgrep $VERSION) -> $DEST_DIR"
