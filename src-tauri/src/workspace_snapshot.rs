//! Atomic read/write for the frontend workspace layout JSON under `~/.blackslate/`
//! (same directory tree as session logs in `~/.blackslate/logs`).

use std::path::PathBuf;
use tauri::AppHandle;

use crate::terminal::logger;

const FILE_NAME: &str = "workspace-layout.json";
const TMP_NAME: &str = ".workspace-layout.json.tmp";

fn blackslate_root() -> Result<PathBuf, String> {
    logger::blackslate_data_root()
        .ok_or_else(|| "could not resolve ~/.blackslate (HOME missing?)".to_string())
}

fn layout_path() -> Result<PathBuf, String> {
    Ok(blackslate_root()?.join(FILE_NAME))
}

fn layout_tmp_path() -> Result<PathBuf, String> {
    Ok(blackslate_root()?.join(TMP_NAME))
}

#[tauri::command]
pub fn workspace_snapshot_read(_app: AppHandle) -> Result<Option<String>, String> {
    let path = layout_path()?;
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn workspace_snapshot_write(_app: AppHandle, content: String) -> Result<(), String> {
    let root = blackslate_root()?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let final_path = layout_path()?;
    let tmp_path = layout_tmp_path()?;

    std::fs::write(&tmp_path, content.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &final_path).map_err(|e| e.to_string())?;
    Ok(())
}
