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
    eprintln!("[blackslate][cmd] pty_create id={id} cols={cols} rows={rows} cwd={cwd:?}");
    let result = state.sessions.create(id.clone(), cols, rows, cwd, app);
    match &result {
        Ok(_) => eprintln!("[blackslate][cmd] pty_create ok id={id}"),
        Err(e) => eprintln!("[blackslate][cmd] pty_create err id={id}: {e}"),
    }
    result
}

#[tauri::command]
pub async fn pty_write(id: String, data: String, state: State<'_, AppState>) -> CommandResult<()> {
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
pub async fn pty_close(id: String, state: State<'_, AppState>) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_close id={id}");
    state.sessions.close(&id);
    Ok(())
}

#[tauri::command]
pub async fn pty_claude_code_active(id: String, state: State<'_, AppState>) -> CommandResult<bool> {
    state.sessions.claude_code_active(&id)
}
