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
// Project stack
// ---------------------------------------------------------------------------

/// Detect project stacks (Rust, Go, Node, React, Python, …) at the nearest project root.
#[tauri::command]
pub async fn project_stack(cwd: String) -> Vec<ProjectStackItem> {
    project_stack_mod::detect(cwd)
}
