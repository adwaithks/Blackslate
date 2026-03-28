use tauri::{AppHandle, State};

use super::error::CommandResult;
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
    eprintln!("[slate][cmd] pty_create id={id} cols={cols} rows={rows}");
    let result = state.sessions.lock().unwrap().create(id.clone(), cols, rows, app);
    match &result {
        Ok(_)  => eprintln!("[slate][cmd] pty_create ok id={id}"),
        Err(e) => eprintln!("[slate][cmd] pty_create err id={id}: {e}"),
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
    let result = state.sessions.lock().unwrap().write(&id, data.as_bytes());
    if let Err(ref e) = result {
        eprintln!("[slate][cmd] pty_write err id={id}: {e}");
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
    eprintln!("[slate][cmd] pty_resize id={id} cols={cols} rows={rows}");
    state.sessions.lock().unwrap().resize(&id, cols, rows)
}

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
}

/// Walk up from `cwd` to find `.git/HEAD`, parse the branch, and check dirty
/// status. Returns `None` when not inside a git repository.
///
/// Branch is read directly from the file (no subprocess, zero overhead).
/// Dirty status spawns `git status --porcelain` once per cwd change only.
#[tauri::command]
pub async fn git_info(cwd: String) -> Option<GitInfo> {
    let mut path = std::path::PathBuf::from(&cwd);

    // Expand a leading ~ to the real home directory.
    if path.starts_with("~") {
        if let Ok(home) = std::env::var("HOME") {
            let rest = path.strip_prefix("~").unwrap().to_path_buf();
            path = std::path::PathBuf::from(home).join(rest);
        }
    }

    // Walk up the tree looking for a .git directory.
    let mut search = path.clone();
    loop {
        let head = search.join(".git").join("HEAD");
        if head.is_file() {
            let content = std::fs::read_to_string(&head).ok()?;
            let content = content.trim();

            let branch = if let Some(b) = content.strip_prefix("ref: refs/heads/") {
                b.to_string()
            } else if content.len() >= 7 {
                format!("({}…)", &content[..7]) // detached HEAD
            } else {
                return None;
            };

            // Dirty check: any output from `git status --porcelain` means dirty.
            let dirty = std::process::Command::new("git")
                .args(["-C", search.to_str().unwrap_or(""), "status", "--porcelain"])
                .output()
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

#[tauri::command]
pub async fn pty_close(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[slate][cmd] pty_close id={id}");
    state.sessions.lock().unwrap().close(&id);
    Ok(())
}
