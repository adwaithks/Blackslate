mod terminal;

use terminal::AppState;
use terminal::commands::{pty_close, pty_create, pty_resize, pty_write};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            pty_create,
            pty_write,
            pty_resize,
            pty_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
