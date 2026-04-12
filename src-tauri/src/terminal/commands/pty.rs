use tauri::{AppHandle, State};

use crate::terminal::error::CommandResult;
use crate::terminal::AppState;

#[tauri::command]
pub fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_default()
}

#[tauri::command]
pub async fn pty_create(
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> CommandResult<()> {
    state.sessions.create(id, cols, rows, cwd, app)
}

#[tauri::command]
pub async fn pty_write(id: String, data: String, state: State<'_, AppState>) -> CommandResult<()> {
    state.sessions.write(&id, data.as_bytes())
}

#[tauri::command]
pub async fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    state.sessions.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_close(id: String, state: State<'_, AppState>) -> CommandResult<()> {
    state.sessions.close(&id);
    Ok(())
}

#[tauri::command]
pub async fn pty_claude_code_active(id: String, state: State<'_, AppState>) -> CommandResult<bool> {
    state.sessions.claude_code_active(&id)
}
