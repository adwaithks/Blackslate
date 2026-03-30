use crate::terminal::resolve_path;

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
}

/// Walk up from `cwd` to find `.git/HEAD`, parse the branch, and check dirty
/// status. Returns `None` when not inside a git repository.
///
/// Branch is read directly from the file (no subprocess, zero overhead).
/// Dirty status spawns `git status --porcelain` asynchronously so the tokio
/// worker thread is not blocked.
#[tauri::command]
pub async fn git_info(cwd: String) -> Option<GitInfo> {
    let mut search = resolve_path(&cwd);

    loop {
        let head = search.join(".git").join("HEAD");
        if head.is_file() {
            let content = std::fs::read_to_string(&head).ok()?;
            let content = content.trim().to_string();

            let branch = if let Some(b) = content.strip_prefix("ref: refs/heads/") {
                b.to_string()
            } else if content.len() >= 7 {
                format!("({}…)", &content[..7]) // detached HEAD
            } else {
                return None;
            };

            let cwd_str = search.to_string_lossy().into_owned();
            let dirty = tokio::process::Command::new("git")
                .args(["-C", &cwd_str, "status", "--porcelain"])
                .output()
                .await
                .map(|o| o.status.success() && !o.stdout.is_empty())
                .unwrap_or(false);

            return Some(GitInfo { branch, dirty });
        }
        if !search.pop() {
            break;
        }
    }
    None
}
