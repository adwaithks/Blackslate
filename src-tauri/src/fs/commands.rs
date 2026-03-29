use std::path::{Path, PathBuf};

use serde::Serialize;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    /// File or directory name (basename only, e.g. "main.rs")
    pub name: String,
    /// Absolute path (e.g. "/Users/foo/project/main.rs")
    pub path: String,
    pub is_dir: bool,
    /// Lowercase extension without the dot, or None (e.g. Some("rs"), None for Makefile)
    pub ext: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Expand a leading `~` to `$HOME`. Mirrors terminal::resolve_path.
fn resolve(p: &str) -> PathBuf {
    let path = PathBuf::from(p);
    if path.starts_with("~") {
        if let Ok(home) = std::env::var("HOME") {
            let rest = path.strip_prefix("~").unwrap().to_path_buf();
            return PathBuf::from(home).join(rest);
        }
    }
    path
}

/// Directories that are never useful to show in a code editor file tree.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    "dist",
    "build",
    ".build",
    ".DS_Store",
    ".cache",
    ".parcel-cache",
    "out",
    ".svelte-kit",
];

fn should_skip(name: &str) -> bool {
    SKIP_DIRS.contains(&name)
}

fn entry_from_path(path: &Path) -> Option<FileEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    let is_dir = path.is_dir();
    let ext = if is_dir {
        None
    } else {
        path.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
    };
    Some(FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir,
        ext,
    })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// List one level of a directory.
///
/// Returns entries sorted: directories first (alpha), then files (alpha).
/// Hidden entries (starting with `.`) are excluded unless `show_hidden` is true.
/// Always skips entries in SKIP_DIRS.
#[tauri::command]
pub async fn fs_list_dir(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let root = resolve(&path);

    let read = std::fs::read_dir(&root)
        .map_err(|e| format!("Cannot read directory '{}': {}", root.display(), e))?;

    let mut entries: Vec<FileEntry> = read
        .filter_map(|r| r.ok())
        .map(|e| e.path())
        .filter(|p| {
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            // Skip always-ignored dirs
            if should_skip(&name) {
                return false;
            }
            // Skip hidden unless requested
            if !show_hidden && name.starts_with('.') {
                return false;
            }
            true
        })
        .filter_map(|p| entry_from_path(&p))
        .collect();

    // Sort: dirs first, then files; each group alphabetically (case-insensitive)
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read a text file and return its contents as a UTF-8 string.
///
/// Rejects files larger than 10 MB or that appear to be binary
/// (null bytes detected in the first 8 KiB).
#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    let resolved = resolve(&path);

    let meta = std::fs::metadata(&resolved)
        .map_err(|e| format!("Cannot stat '{}': {}", resolved.display(), e))?;

    const MAX_BYTES: u64 = 10 * 1024 * 1024; // 10 MiB
    if meta.len() > MAX_BYTES {
        return Err(format!(
            "File is too large to open ({} MiB). Maximum is 10 MiB.",
            meta.len() / 1024 / 1024
        ));
    }

    let bytes = std::fs::read(&resolved)
        .map_err(|e| format!("Cannot read '{}': {}", resolved.display(), e))?;

    // Binary detection: look for null bytes in the first 8 KiB
    let probe = &bytes[..bytes.len().min(8192)];
    if probe.contains(&0u8) {
        return Err("Binary file — cannot display.".to_string());
    }

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// Write a UTF-8 string to a file (creates or overwrites).
#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<(), String> {
    let resolved = resolve(&path);
    std::fs::write(&resolved, content.as_bytes())
        .map_err(|e| format!("Cannot write '{}': {}", resolved.display(), e))
}
