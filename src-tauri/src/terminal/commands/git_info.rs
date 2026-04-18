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

async fn git_cmd(cwd: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    tokio::process::Command::new("git")
        .args(
            std::iter::once("-C")
                .chain(std::iter::once(cwd))
                .chain(args.iter().copied()),
        )
        .output()
        .await
}

/// Branch label from `.git/HEAD` file contents (trimmed). `None` when not a branch ref and
/// the hash is too short to display (mirrors `git_info` behaviour).
#[cfg(test)]
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

/// Resolve repo root, branch label, dirty flag, and worktree-ness using `git` (same approach as
/// `git_discover_repo_root` / `get_git_status`). Returns `None` when `cwd` is not inside a repo.
#[tauri::command]
pub async fn git_info(cwd: String) -> Option<GitInfo> {
    let cwd_str = resolve_path(&cwd).to_string_lossy().into_owned();

    let (top_out, sym_out, dirty_out) = tokio::join!(
        git_cmd(&cwd_str, &["rev-parse", "--show-toplevel"]),
        git_cmd(&cwd_str, &["symbolic-ref", "-q", "--short", "HEAD"]),
        git_cmd(&cwd_str, &["status", "--porcelain"]),
    );

    let top = top_out.ok()?;
    if !top.status.success() {
        return None;
    }
    let root_raw = String::from_utf8_lossy(&top.stdout).trim().to_string();
    if root_raw.is_empty() {
        return None;
    }
    let root = std::fs::canonicalize(&root_raw)
        .unwrap_or_else(|_| root_raw.into())
        .to_string_lossy()
        .into_owned();

    let branch = match sym_out.ok().filter(|o| o.status.success()) {
        Some(o) => {
            let name = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if name.is_empty() {
                return None;
            }
            name
        }
        None => {
            let rev = git_cmd(&cwd_str, &["rev-parse", "HEAD"]).await.ok()?;
            if !rev.status.success() {
                return None;
            }
            let h = String::from_utf8_lossy(&rev.stdout).trim().to_string();
            if h.len() < 7 {
                return None;
            }
            format!("({}…)", &h[..7])
        }
    };

    let dirty = dirty_out
        .ok()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);

    let is_worktree = std::path::Path::new(&root).join(".git").is_file();

    Some(GitInfo {
        branch,
        dirty,
        root,
        is_worktree,
    })
}

#[cfg(test)]
#[path = "tests/git_info.test.rs"]
mod git_info_tests;
