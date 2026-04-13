use std::path::{Path, PathBuf};

use crate::terminal::resolve_path;

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
}

/// Path to the `HEAD` file for a directory that is a git worktree root.
///
/// - Normal clone: `<root>/.git/` is a directory → `<root>/.git/HEAD`.
/// - Linked worktree: `<root>/.git` is a **file** with `gitdir: …/worktrees/<name>` →
///   HEAD lives in that gitdir, not under `<root>/.git/HEAD` (which is not a valid path).
fn head_path_for_git_workdir(repo_root: &Path) -> Option<PathBuf> {
    let git_path = repo_root.join(".git");
    if git_path.is_dir() {
        let head = git_path.join("HEAD");
        return head.is_file().then_some(head);
    }
    if git_path.is_file() {
        let content = std::fs::read_to_string(&git_path).ok()?;
        let line = content.lines().next()?.trim();
        let gitdir = line.strip_prefix("gitdir:")?.trim();
        let resolved = if Path::new(gitdir).is_absolute() {
            PathBuf::from(gitdir)
        } else {
            repo_root.join(gitdir)
        };
        let head = resolved.join("HEAD");
        return head.is_file().then_some(head);
    }
    None
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
        if let Some(head_path) = head_path_for_git_workdir(&search) {
            let content = std::fs::read_to_string(&head_path).ok()?;
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
mod head_path_tests {
    use super::*;
    use std::fs;

    #[test]
    fn normal_repo_git_is_directory() {
        let base =
            std::env::temp_dir().join(format!("bs-gitinfo-dir-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let repo = base.join("repo");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::write(repo.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        let head = head_path_for_git_workdir(&repo).expect("HEAD path");
        assert_eq!(head, repo.join(".git/HEAD"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn linked_worktree_git_is_file_with_gitdir() {
        let base =
            std::env::temp_dir().join(format!("bs-gitinfo-wt-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let wt = base.join("worktree");
        let gitdir = base.join("real_gitdir");
        fs::create_dir_all(&gitdir).unwrap();
        fs::write(gitdir.join("HEAD"), "ref: refs/heads/feature-wt\n").unwrap();
        fs::create_dir_all(&wt).unwrap();
        fs::write(
            wt.join(".git"),
            format!("gitdir: {}\n", gitdir.display()),
        )
        .unwrap();
        let head = head_path_for_git_workdir(&wt).expect("HEAD path");
        assert_eq!(head, gitdir.join("HEAD"));
        let label =
            branch_label_from_git_head(&fs::read_to_string(&head).unwrap()).unwrap();
        assert_eq!(label, "feature-wt");
        let _ = fs::remove_dir_all(&base);
    }
}

#[cfg(test)]
#[path = "tests/git_info.test.rs"]
mod git_info_tests;
