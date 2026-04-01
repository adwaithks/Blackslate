use tauri::State;

use crate::terminal::logger;
use crate::terminal::AppState;

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
        None => SessionPaths {
            log: None,
            raw: None,
        },
    }
}
