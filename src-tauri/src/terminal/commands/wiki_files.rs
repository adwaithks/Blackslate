use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Prefix for errors returned when the ripgrep sidecar cannot be resolved or spawned.
/// The frontend detects this to show setup instructions (`wikiRipgrep.ts` — keep substrings in sync).
pub const WIKI_RG_UNAVAILABLE: &str = "WIKI_RG_UNAVAILABLE";

/// macOS / FS permission limits (home folder, TCC, sandbox) — show tailored UI.
pub const WIKI_RG_ACCESS_DENIED: &str = "WIKI_RG_ACCESS_DENIED";

/// Prefix when ripgrep failed for other reasons (output cap, unexpected stderr, etc.).
pub const WIKI_RG_FAILED: &str = "WIKI_RG_FAILED";

/// Max paths returned to the UI.
const MAX_RESULTS: usize = 1000;
/// Raw non-empty lines from `rg` stdout before filtering (safety cap).
const MAX_PARSE_LINES: usize = 200_000;

/// Dot-prefixed **directory** names we still traverse (agent/editor/project tooling that often has `.md`).
const ALLOWED_DOT_DIRS: &[&str] = &[
    ".claude",
    ".cursor",
    ".github",
    ".vscode",
    ".husky",
    ".changeset",
    ".storybook",
    ".obsidian",
    ".mkdocs",
];

fn wiki_rg_err(detail: impl std::fmt::Display) -> String {
    format!("{WIKI_RG_UNAVAILABLE}: {detail}")
}

fn wiki_rg_access_denied(detail: impl std::fmt::Display) -> String {
    format!("{WIKI_RG_ACCESS_DENIED}: {detail}")
}

fn wiki_rg_failed(detail: impl std::fmt::Display) -> String {
    format!("{WIKI_RG_FAILED}: {detail}")
}

/// `rg` stderr lines we treat as "expected" when scanning broad trees (e.g. `$HOME` on macOS).
fn stderr_line_is_ignorable_access_error(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    lower.contains("operation not permitted")
        || lower.contains("permission denied")
        || lower.contains("access is denied")
        || lower.contains("os error 1")
        || lower.contains("os error 13")
}

/// Every non-empty stderr line is an ignorable access error (typical macOS TCC spam under home).
fn stderr_is_only_ignorable_access_errors(stderr: &str) -> bool {
    let t = stderr.trim();
    if t.is_empty() {
        return false;
    }
    t.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .all(stderr_line_is_ignorable_access_error)
}

/// True if `path` may be listed: every parent path segment that starts with `.` must be in [`ALLOWED_DOT_DIRS`].
/// The file basename may start with `.` (e.g. `.notes.md`).
fn markdown_path_allowed(path: &str) -> bool {
    let norm = path.replace('\\', "/");
    let parts: Vec<&str> = norm.split('/').filter(|s| !s.is_empty()).collect();
    if parts.len() <= 1 {
        return true;
    }
    for segment in &parts[..parts.len() - 1] {
        if forbidden_dot_parent_dir(segment) {
            return false;
        }
    }
    true
}

fn forbidden_dot_parent_dir(segment: &str) -> bool {
    if !segment.starts_with('.') || segment == "." || segment == ".." {
        return false;
    }
    !ALLOWED_DOT_DIRS.iter().any(|&allowed| allowed == segment)
}

/// List `.md` / `.mdx` under `dir` using the bundled ripgrep sidecar only.
#[tauri::command]
pub async fn list_md_files(app: AppHandle, dir: String) -> Result<Vec<String>, String> {
    let root = Path::new(&dir);
    if !root.is_dir() {
        return Ok(vec![]);
    }

    list_md_files_via_rg_sidecar(&app, &dir).await
}

async fn list_md_files_via_rg_sidecar(app: &AppHandle, dir: &str) -> Result<Vec<String>, String> {
    // `bundle.externalBin` is `binaries/rg` on disk, but tauri-build places the binary next to the app as `rg`.
    let sidecar = app
        .shell()
        .sidecar(Path::new("rg"))
        .map_err(wiki_rg_err)?;

    let output = sidecar
        .args([
            "--files",
            "--no-messages",
            "--hidden",
            "--max-depth",
            "10",
            "--iglob",
            "*.md",
            "--iglob",
            "*.mdx",
            dir,
        ])
        .output()
        .await
        .map_err(wiki_rg_err)?;

    let code = output.status.code();
    let stdout_len = output.stdout.len();

    let stderr_str = String::from_utf8_lossy(&output.stderr);
    let trimmed_stderr = stderr_str.trim();

    let permission_only_stderr = stderr_is_only_ignorable_access_errors(trimmed_stderr);
    // `--no-messages` clears most stderr; rg may still exit 2 after hitting TCC-protected paths.
    let accept_stdout = output.status.success()
        || (stdout_len > 0 && (permission_only_stderr || trimmed_stderr.is_empty()));

    if !accept_stdout {
        if stdout_len == 0 && permission_only_stderr {
            return Err(wiki_rg_access_denied(format!(
                "Ripgrep could not read paths under this folder (exit {:?}). On macOS, scanning a very large scope such as your home directory hits privacy-protected locations (Downloads, Library, Mail, Photos, etc.). Use the wiki picker from a project directory instead.",
                code
            )));
        }

        return Err(wiki_rg_failed(format!(
            "ripgrep exited with status {:?}: {}",
            code,
            trimmed_stderr
        )));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut raw: Vec<String> = Vec::new();
    for line in text.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if raw.len() >= MAX_PARSE_LINES {
            return Err(wiki_rg_failed(format!(
                "Too many markdown paths under this folder (over {MAX_PARSE_LINES} candidates before filtering). The tree may be too large; try a smaller directory."
            )));
        }
        raw.push(t.to_string());
    }

    let mut paths: Vec<String> = raw
        .into_iter()
        .filter(|p| markdown_path_allowed(p))
        .collect();

    paths.sort();
    paths.dedup();
    paths.truncate(MAX_RESULTS);

    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::{markdown_path_allowed, stderr_is_only_ignorable_access_errors};

    #[test]
    fn allows_normal_paths() {
        assert!(markdown_path_allowed("/proj/README.md"));
        assert!(markdown_path_allowed("/proj/docs/a.md"));
    }

    #[test]
    fn rejects_dot_git_parent() {
        assert!(!markdown_path_allowed("/proj/.git/hooks/README.md"));
    }

    #[test]
    fn allows_dot_claude() {
        assert!(markdown_path_allowed("/proj/.claude/skills/x/SKILL.md"));
    }

    #[test]
    fn allows_dot_in_filename_only() {
        assert!(markdown_path_allowed("/proj/.notes.md"));
    }

    #[test]
    fn rejects_unknown_dot_dir() {
        assert!(!markdown_path_allowed("/proj/.cache/pkg/readme.md"));
    }

    #[test]
    fn stderr_permission_noise_detection() {
        let sample = "rg: /Users/x/Downloads: Operation not permitted (os error 1)\n\
            rg: /Users/x/Library/Mail: Operation not permitted (os error 1)\n";
        assert!(stderr_is_only_ignorable_access_errors(sample));
        assert!(!stderr_is_only_ignorable_access_errors(
            "rg: some other failure\n"
        ));
    }
}
