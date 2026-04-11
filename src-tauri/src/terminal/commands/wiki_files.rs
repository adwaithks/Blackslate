use std::path::Path;

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".next",
    ".nuxt",
    "out",
    ".cache",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
];

/// Recursively find all .md files under `dir`, skipping common noise directories.
/// Returns absolute paths. Capped at 500 results to avoid overwhelming the UI.
#[tauri::command]
pub fn list_md_files(dir: String) -> Vec<String> {
    let root = Path::new(&dir);
    if !root.is_dir() {
        return vec![];
    }

    let mut results = Vec::new();
    collect_md_files(root, &mut results, 0);
    results.sort();
    results
}

fn collect_md_files(dir: &Path, results: &mut Vec<String>, depth: usize) {
    if depth > 10 || results.len() >= 500 {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        if results.len() >= 500 {
            break;
        }
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Skip hidden dirs and known noise
        if name_str.starts_with('.') && path.is_dir() {
            continue;
        }
        if path.is_dir() && SKIP_DIRS.contains(&name_str.as_ref()) {
            continue;
        }

        if path.is_dir() {
            collect_md_files(&path, results, depth + 1);
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Some(s) = path.to_str() {
                results.push(s.to_string());
            }
        }
    }
}
