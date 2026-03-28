mod terminal;

#[cfg(target_os = "macos")]
mod macos_menu;

use terminal::AppState;
use terminal::commands::{
    get_home_dir, get_log_dir, git_info, project_stack, pty_claude_code_active, pty_close,
    pty_create, pty_resize, pty_session_paths, pty_write,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            pty_create,
            pty_write,
            pty_resize,
            pty_close,
            pty_claude_code_active,
            git_info,
            project_stack,
            get_home_dir,
            get_log_dir,
            pty_session_paths,
        ]);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .menu(|app| macos_menu::default_menu(app))
            .on_menu_event(|app, event| {
                if event.id().as_ref() == "slate.quit" {
                    app.exit(0);
                }
            });
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
