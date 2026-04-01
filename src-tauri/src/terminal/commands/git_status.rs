use crate::terminal::error::CommandResult;
use crate::terminal::resolve_path;
use std::hash::{Hash, Hasher};

#[derive(serde::Serialize, Clone)]
pub struct GitFile {
    pub path: String,
    pub additions: i64, // -1 = binary
    pub deletions: i64,
    /// "modified" | "added" | "deleted" | "renamed"
    pub status: String,
}

#[derive(serde::Serialize)]
pub struct GitStatusResult {
    /// Current branch name (`git rev-parse --abbrev-ref HEAD`).
    pub branch: String,
    pub unstaged: Vec<GitFile>,
    pub staged: Vec<GitFile>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusPollResult {
    pub changed: bool,
    pub hash: String,
    pub status: Option<GitStatusResult>,
}

fn parse_name_status(output: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() < 2 {
            continue;
        }
        let code = parts[0].chars().next().unwrap_or('M');
        // Renames: parts[0]=R100, parts[1]=old path, parts[2]=new path
        let path = if code == 'R' && parts.len() == 3 {
            parts[2].to_string()
        } else {
            parts[1].to_string()
        };
        let status = match code {
            'A' => "added",
            'D' => "deleted",
            'R' => "renamed",
            _ => "modified",
        };
        map.insert(path, status.to_string());
    }
    map
}

fn parse_numstat(output: &str) -> std::collections::HashMap<String, (i64, i64)> {
    let mut map = std::collections::HashMap::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() == 3 {
            let add: i64 = parts[0].parse().unwrap_or(-1);
            let del: i64 = parts[1].parse().unwrap_or(-1);
            map.insert(parts[2].to_string(), (add, del));
        }
    }
    map
}

async fn numstat_untracked(cwd: &str, rel_path: &str) -> (i64, i64) {
    let out = match git_cmd(
        cwd,
        &[
            "diff",
            "--numstat",
            "--no-index",
            "--",
            "/dev/null",
            rel_path,
        ],
    )
    .await
    {
        Ok(o) if o.status.success() => o,
        _ => return (0, 0),
    };
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let line = stdout.lines().next().unwrap_or_default();
    let parts: Vec<&str> = line.splitn(3, '\t').collect();
    if parts.len() < 2 {
        return (0, 0);
    }
    let add = parts[0].parse::<i64>().unwrap_or(-1);
    let del = parts[1].parse::<i64>().unwrap_or(-1);
    (add, del)
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

fn hash_status(s: &GitStatusResult) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.branch.hash(&mut hasher);
    for f in &s.unstaged {
        f.path.hash(&mut hasher);
        f.additions.hash(&mut hasher);
        f.deletions.hash(&mut hasher);
        f.status.hash(&mut hasher);
    }
    for f in &s.staged {
        f.path.hash(&mut hasher);
        f.additions.hash(&mut hasher);
        f.deletions.hash(&mut hasher);
        f.status.hash(&mut hasher);
    }
    hasher.finish().to_string()
}

/// Git worktree root for `cwd` (`git rev-parse --show-toplevel`). Canonical path for stable dedup.
#[tauri::command]
pub async fn git_discover_repo_root(cwd: String) -> Option<String> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    let out = git_cmd(&cwd_str, &["rev-parse", "--show-toplevel"])
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let root = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if root.is_empty() {
        return None;
    }
    match std::fs::canonicalize(&root) {
        Ok(p) => Some(p.to_string_lossy().into_owned()),
        Err(_) => Some(root),
    }
}

/// Returns staged and unstaged file lists with diff stats for the repo containing `cwd`.
#[tauri::command]
pub async fn get_git_status(cwd: String) -> Option<GitStatusResult> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    let check = git_cmd(&cwd_str, &["rev-parse", "--git-dir"]).await.ok()?;
    if !check.status.success() {
        return None;
    }

    let (branch_out, unstaged_out, staged_out, untracked_out, unstaged_ns_out, staged_ns_out) = tokio::join!(
        git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"]),
        git_cmd(&cwd_str, &["diff", "--numstat"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--numstat"]),
        git_cmd(&cwd_str, &["ls-files", "--others", "--exclude-standard"]),
        git_cmd(&cwd_str, &["diff", "--name-status"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--name-status"]),
    );

    let branch = branch_out
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "HEAD".to_string());

    let unstaged_map = unstaged_out
        .ok()
        .map(|o| parse_numstat(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let staged_map = staged_out
        .ok()
        .map(|o| parse_numstat(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let unstaged_ns = unstaged_ns_out
        .ok()
        .map(|o| parse_name_status(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let staged_ns = staged_ns_out
        .ok()
        .map(|o| parse_name_status(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();

    let mut unstaged: Vec<GitFile> = unstaged_map
        .into_iter()
        .map(|(path, (additions, deletions))| {
            let status = unstaged_ns
                .get(&path)
                .cloned()
                .unwrap_or_else(|| "modified".to_string());
            GitFile {
                path,
                additions,
                deletions,
                status,
            }
        })
        .collect();

    if let Ok(out) = untracked_out {
        for raw in String::from_utf8_lossy(&out.stdout).lines() {
            let path = raw.trim().to_string();
            if path.is_empty() {
                continue;
            }
            let (additions, deletions) = numstat_untracked(&cwd_str, &path).await;
            unstaged.push(GitFile {
                path,
                additions,
                deletions,
                status: "added".to_string(),
            });
        }
    }

    unstaged.sort_by(|a, b| a.path.cmp(&b.path));

    let mut staged: Vec<GitFile> = staged_map
        .into_iter()
        .map(|(path, (additions, deletions))| {
            let status = staged_ns
                .get(&path)
                .cloned()
                .unwrap_or_else(|| "modified".to_string());
            GitFile {
                path,
                additions,
                deletions,
                status,
            }
        })
        .collect();
    staged.sort_by(|a, b| a.path.cmp(&b.path));

    Some(GitStatusResult {
        branch,
        unstaged,
        staged,
    })
}

/// Poll-friendly variant: returns a stable `hash` and `changed` flag. When unchanged, `status` is `None`
/// so the frontend can avoid re-rendering.
#[tauri::command]
pub async fn get_git_status_poll(
    cwd: String,
    prev_hash: Option<String>,
) -> Option<GitStatusPollResult> {
    let status = get_git_status(cwd).await?;
    let hash = hash_status(&status);
    let changed = prev_hash.as_deref() != Some(hash.as_str());
    Some(GitStatusPollResult {
        changed,
        hash,
        status: if changed { Some(status) } else { None },
    })
}

#[tauri::command]
pub async fn stage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn unstage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn discard_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        return Ok(());
    }
    let full = std::path::PathBuf::from(&cwd_str).join(&path);
    std::fs::remove_file(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stage_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "-A"])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn unstage_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "."])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn discard_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let (restore_out, clean_out) = tokio::join!(
        git_cmd(&cwd_str, &["restore", "."]),
        git_cmd(&cwd_str, &["clean", "-fd"]),
    );
    let restore_ok = restore_out.map(|o| o.status.success()).unwrap_or(false);
    let clean_ok = clean_out.map(|o| o.status.success()).unwrap_or(false);
    if restore_ok || clean_ok {
        Ok(())
    } else {
        Err("discard_all failed".into())
    }
}
