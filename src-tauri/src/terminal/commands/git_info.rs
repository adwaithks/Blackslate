use crate::terminal::resolve_path;

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
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
            let branch = branch_label_from_git_head(&content)?;

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

#[cfg(test)]
#[path = "tests/git_info.test.rs"]
mod git_info_tests;
