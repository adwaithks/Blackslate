use crate::terminal::resolve_path;

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
    /// Canonical path to the worktree root (the directory that contains `.git`).
    /// Stable across `cd` changes within the same repo; used as a dedup key.
    pub root: String,
    /// True when this is a linked git worktree (`.git` is a file, not a directory).
    pub is_worktree: bool,
}

/// Branch label from `.git/HEAD` file contents (trimmed). `None` when not a branch ref and
/// the hash is too short to display (mirrors `git_info` behaviour).
fn branch_label_from_git_head(content: &str) -> Option<String> {
    let content = content.trim();
    if let Some(b) = content.strip_prefix("ref: refs/heads/") {
        return Some(b.to_string());
    }
    if content.len() >= 7 {
        return Some(format!("({}…)", &content[..7]));
    }
    None
}

/// Walk up from `cwd` to find `.git`, parse the branch, and check dirty status.
/// Handles both regular repos (`.git/` directory) and linked worktrees (`.git` file).
/// Returns `None` when not inside a git repository.
///
/// Branch is read directly from the HEAD file (no subprocess, zero overhead).
/// Dirty status spawns `git status --porcelain` asynchronously.
#[tauri::command]
pub async fn git_info(cwd: String) -> Option<GitInfo> {
    let mut search = resolve_path(&cwd);

    loop {
        let dot_git = search.join(".git");

        // Regular repo: .git is a directory containing HEAD directly.
        let (head_content, is_worktree) = if dot_git.is_dir() {
            (std::fs::read_to_string(dot_git.join("HEAD")).ok(), false)
        } else if dot_git.is_file() {
            // Linked worktree: .git is a file with "gitdir: /path/to/gitdir"
            let file = match std::fs::read_to_string(&dot_git) {
                Ok(f) => f,
                Err(_) => { if !search.pop() { break; } continue; }
            };
            let gitdir = match file.trim().strip_prefix("gitdir: ") {
                Some(d) => d,
                None => { if !search.pop() { break; } continue; }
            };
            let gitdir_path = if std::path::Path::new(gitdir).is_absolute() {
                std::path::PathBuf::from(gitdir)
            } else {
                search.join(gitdir)
            };
            (std::fs::read_to_string(gitdir_path.join("HEAD")).ok(), true)
        } else {
            (None, false)
        };

        if let Some(content) = head_content {
            let branch = branch_label_from_git_head(&content)?;
            let root = std::fs::canonicalize(&search)
                .unwrap_or_else(|_| search.clone())
                .to_string_lossy()
                .into_owned();

            let dirty = tokio::process::Command::new("git")
                .args(["-C", &root, "status", "--porcelain"])
                .output()
                .await
                .map(|o| o.status.success() && !o.stdout.is_empty())
                .unwrap_or(false);

            return Some(GitInfo { branch, dirty, root, is_worktree });
        }

        if !search.pop() {
            break;
        }
    }
    None
}

#[cfg(test)]
#[path = "tests/git_info.test.rs"]
mod git_info_tests;
