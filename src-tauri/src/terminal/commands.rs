use tauri::{AppHandle, State};

use super::error::CommandResult;
use super::logger;
use super::project_stack::{self as project_stack_mod, ProjectStackItem};
use super::AppState;

#[tauri::command]
pub fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_default()
}

#[tauri::command]
pub async fn pty_create(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: AppHandle,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_create id={id} cols={cols} rows={rows}");
    let result = state.sessions.create(id.clone(), cols, rows, app);
    match &result {
        Ok(_) => eprintln!("[blackslate][cmd] pty_create ok id={id}"),
        Err(e) => eprintln!("[blackslate][cmd] pty_create err id={id}: {e}"),
    }
    result
}

#[tauri::command]
pub async fn pty_write(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    // Don't log every keystroke — only log if it errors.
    let result = state.sessions.write(&id, data.as_bytes());
    if let Err(ref e) = result {
        eprintln!("[blackslate][cmd] pty_write err id={id}: {e}");
    }
    result
}

#[tauri::command]
pub async fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_resize id={id} cols={cols} rows={rows}");
    state.sessions.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_close(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_close id={id}");
    state.sessions.close(&id);
    Ok(())
}

#[tauri::command]
pub async fn pty_claude_code_active(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<bool> {
    state.sessions.claude_code_active(&id)
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/// Returns the path to the session log directory (`~/.blackslate/logs`).
/// Use this to know where to find `.log` and `.raw` files.
#[tauri::command]
pub fn get_log_dir() -> Option<String> {
    logger::log_dir().map(|p| p.to_string_lossy().into_owned())
}

/// Returns the log and raw file paths for a given PTY session id.
/// Both are `None` when logging was unavailable (e.g. permission error).
#[derive(serde::Serialize)]
pub struct SessionPaths {
    pub log: Option<String>,
    pub raw: Option<String>,
}

#[tauri::command]
pub fn pty_session_paths(id: String, state: State<'_, AppState>) -> SessionPaths {
    match state.sessions.get_paths(&id) {
        Some((log, raw)) => SessionPaths { log, raw },
        None => SessionPaths { log: None, raw: None },
    }
}

// ---------------------------------------------------------------------------
// Git info
// ---------------------------------------------------------------------------

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
    let mut search = super::resolve_path(&cwd);

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

// ---------------------------------------------------------------------------
// Git status / staging
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct GitFile {
    pub path: String,
    pub additions: i64, // -1 = binary
    pub deletions: i64,
}

#[derive(serde::Serialize)]
pub struct GitStatusResult {
    /// Current branch name (`git rev-parse --abbrev-ref HEAD`).
    pub branch: String,
    pub unstaged: Vec<GitFile>,
    pub staged: Vec<GitFile>,
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

/// Line stats for an untracked path (`git diff` omits these). Uses `git diff --no-index` against `/dev/null`.
async fn numstat_untracked(cwd: &str, rel_path: &str) -> (i64, i64) {
    let out = match git_cmd(
        cwd,
        &["diff", "--numstat", "--no-index", "--", "/dev/null", rel_path],
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
        .args(std::iter::once("-C").chain(std::iter::once(cwd)).chain(args.iter().copied()))
        .output()
        .await
}

/// Git worktree root for `cwd` (`git rev-parse --show-toplevel`). Canonical path for stable dedup.
#[tauri::command]
pub async fn git_discover_repo_root(cwd: String) -> Option<String> {
    let resolved = super::resolve_path(&cwd);
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
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    // Bail early if not in a git repo
    let check = git_cmd(&cwd_str, &["rev-parse", "--git-dir"]).await.ok()?;
    if !check.status.success() {
        return None;
    }

    let (branch_out, unstaged_out, staged_out, untracked_out) = tokio::join!(
        git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"]),
        git_cmd(&cwd_str, &["diff", "--numstat"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--numstat"]),
        git_cmd(&cwd_str, &["ls-files", "--others", "--exclude-standard"]),
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

    let mut unstaged: Vec<GitFile> = unstaged_map
        .into_iter()
        .map(|(path, (additions, deletions))| GitFile { path, additions, deletions })
        .collect();

    // Append untracked files — `git diff --numstat` omits them; use --no-index vs /dev/null.
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
            });
        }
    }

    unstaged.sort_by(|a, b| a.path.cmp(&b.path));

    let mut staged: Vec<GitFile> = staged_map
        .into_iter()
        .map(|(path, (additions, deletions))| GitFile { path, additions, deletions })
        .collect();
    staged.sort_by(|a, b| a.path.cmp(&b.path));

    Some(GitStatusResult {
        branch,
        unstaged,
        staged,
    })
}

#[tauri::command]
pub async fn stage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn unstage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn discard_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    // Try restore first (tracked files); fall back to removing untracked file
    let out = git_cmd(&cwd_str, &["restore", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() {
        return Ok(());
    }
    let full = std::path::PathBuf::from(&cwd_str).join(&path);
    std::fs::remove_file(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stage_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "-A"]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn unstage_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "."]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn discard_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let (restore_out, clean_out) = tokio::join!(
        git_cmd(&cwd_str, &["restore", "."]),
        git_cmd(&cwd_str, &["clean", "-fd"]),
    );
    let restore_ok = restore_out.map(|o| o.status.success()).unwrap_or(false);
    let clean_ok = clean_out.map(|o| o.status.success()).unwrap_or(false);
    if restore_ok || clean_ok { Ok(()) } else { Err("discard_all failed".into()) }
}

// ---------------------------------------------------------------------------
// Native folder picker (macOS)
// ---------------------------------------------------------------------------

/// Opens a native macOS folder picker (multiple-select) via osascript.
/// Returns the selected POSIX paths, or an empty vec on cancel / error.
#[tauri::command]
pub async fn pick_folders() -> Vec<String> {
    // AppleScript: on cancel the error handler returns empty string so we
    // never propagate an error to the frontend.
    let script = r#"try
    set theChosenFolders to choose folder with prompt "Select git repositories:" with multiple selections allowed
    set output to ""
    repeat with aFolder in theChosenFolders
        set output to output & POSIX path of aFolder & "\n"
    end repeat
    return output
on error
    return ""
end try"#;

    let result = tokio::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .await;

    match result {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout).into_owned();
            raw.lines()
                .map(|l| l.trim().trim_end_matches('/').to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        Err(_) => vec![],
    }
}

// ---------------------------------------------------------------------------
// Project stack
// ---------------------------------------------------------------------------

/// Detect project stacks (Rust, Go, Node, React, Python, …) at the nearest project root.
#[tauri::command]
pub async fn project_stack(cwd: String) -> Vec<ProjectStackItem> {
    project_stack_mod::detect(cwd)
}
