use crate::terminal::error::{cmd_err, CommandResult};
use crate::terminal::resolve_path;
use std::path::Path;

#[derive(serde::Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum GitDiffMode {
    /// Diff from last commit (HEAD) to working tree.
    HeadToWorktree,
    /// Diff from last commit (HEAD) to index (staged changes).
    HeadToIndex,
    /// Diff from index (staged) to working tree.
    IndexToWorktree,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffBundle {
    pub diff: String,
    pub old_content: String,
    pub new_content: String,
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

/// `git diff` uses exit **1** when there are differences, **0** when there is no diff.
/// Other codes indicate errors. Treating only `success()` as OK breaks new files and
/// any change that produces a non-empty patch.
fn git_diff_exited_ok(status: &std::process::ExitStatus) -> bool {
    status.success() || status.code() == Some(1)
}

async fn is_tracked(cwd: &str, path: &str) -> bool {
    git_cmd(cwd, &["ls-files", "--error-unmatch", "--", path])
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

async fn git_show_blob(cwd: &str, rev: &str) -> String {
    match git_cmd(cwd, &["show", rev]).await {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).into_owned(),
        _ => String::new(),
    }
}

async fn read_worktree(repo_root: &Path, rel_path: &str) -> String {
    let abs = repo_root.join(rel_path);
    match tokio::fs::read(&abs).await {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(_) => String::new(),
    }
}

async fn git_diff_file_contents(
    repo_root: &Path,
    cwd_str: &str,
    path: &str,
    mode: GitDiffMode,
    tracked: bool,
) -> (String, String) {
    if !tracked {
        let new_content = read_worktree(repo_root, path).await;
        return (String::new(), new_content);
    }

    match mode {
        GitDiffMode::HeadToWorktree => {
            let old_spec = format!("HEAD:{}", path);
            let old_content = git_show_blob(cwd_str, &old_spec).await;
            let new_content = read_worktree(repo_root, path).await;
            (old_content, new_content)
        }
        GitDiffMode::HeadToIndex => {
            let old_spec = format!("HEAD:{}", path);
            let idx_spec = format!(":{}", path);
            let old_content = git_show_blob(cwd_str, &old_spec).await;
            let new_content = git_show_blob(cwd_str, &idx_spec).await;
            (old_content, new_content)
        }
        GitDiffMode::IndexToWorktree => {
            let idx_spec = format!(":{}", path);
            let old_content = git_show_blob(cwd_str, &idx_spec).await;
            let new_content = read_worktree(repo_root, path).await;
            (old_content, new_content)
        }
    }
}

async fn git_diff_inner(
    cwd_str: &str,
    path: &str,
    mode: GitDiffMode,
    tracked: bool,
) -> CommandResult<String> {
    let args: Vec<&str> = match (mode, tracked) {
        (GitDiffMode::HeadToWorktree, true) => vec!["diff", "--no-color", "HEAD", "--", path],
        (GitDiffMode::HeadToIndex, true) => {
            vec!["diff", "--no-color", "--cached", "HEAD", "--", path]
        }
        (GitDiffMode::IndexToWorktree, true) => vec!["diff", "--no-color", "--", path],
        (_, false) => vec!["diff", "--no-color", "--no-index", "--", "/dev/null", path],
    };

    let out = git_cmd(cwd_str, &args).await.map_err(cmd_err)?;
    if !git_diff_exited_ok(&out.status) {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[tauri::command]
pub async fn get_git_diff(cwd: String, path: String, mode: GitDiffMode) -> CommandResult<String> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let tracked = is_tracked(&cwd_str, &path).await;
    git_diff_inner(&cwd_str, &path, mode, tracked).await
}

/// Diff text plus full old/new file contents so `@git-diff-view` can expand context
/// (it disables expansion when both sides are composed from the patch only).
#[tauri::command]
pub async fn get_git_diff_bundle(
    cwd: String,
    path: String,
    mode: GitDiffMode,
) -> CommandResult<GitDiffBundle> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let tracked = is_tracked(&cwd_str, &path).await;

    let diff = git_diff_inner(&cwd_str, &path, mode, tracked).await?;
    let (old_content, new_content) =
        git_diff_file_contents(&resolved, &cwd_str, &path, mode, tracked).await;

    Ok(GitDiffBundle {
        diff,
        old_content,
        new_content,
    })
}
