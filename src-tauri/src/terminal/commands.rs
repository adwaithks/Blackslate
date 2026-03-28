use tauri::{AppHandle, State};

use super::error::CommandResult;
use super::AppState;

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

#[tauri::command]
pub async fn pty_close(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[slate][cmd] pty_close id={id}");
    state.sessions.lock().unwrap().close(&id);
    Ok(())
}
