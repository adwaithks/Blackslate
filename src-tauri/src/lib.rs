mod terminal;

#[cfg(target_os = "macos")]
mod macos_menu;

use tauri::{Emitter, Manager};
use terminal::commands::{
    discard_all, discard_file, get_git_diff, get_git_diff_bundle, get_git_status,
    get_git_status_poll, get_home_dir, get_log_dir, git_discover_repo_root, git_info,
    list_claude_projects, list_claude_sessions, list_global_hooks, list_global_skills,
    list_md_files, list_project_hooks, list_project_skills, pick_folders, pty_claude_code_active,
    pty_close,
    pty_create, pty_resize, pty_session_paths, pty_write, read_skill_content, stage_all,
    stage_file, unstage_all, unstage_file,
};
use terminal::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    // ExitRequested handler runs `SessionManager::close_all` before teardown.
    app.exit(0);
}

pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            quit_app,
            pty_create,
            pty_write,
            pty_resize,
            pty_close,
            pty_claude_code_active,
            git_info,
            get_home_dir,
            get_log_dir,
            pty_session_paths,
            get_git_status,
            get_git_status_poll,
            get_git_diff,
            get_git_diff_bundle,
            stage_file,
            unstage_file,
            discard_file,
            stage_all,
            unstage_all,
            discard_all,
            pick_folders,
            git_discover_repo_root,
            list_claude_sessions,
            list_global_skills,
            list_claude_projects,
            list_project_skills,
            read_skill_content,
            list_global_hooks,
            list_project_hooks,
            list_md_files,
        ]);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .menu(|app| macos_menu::default_menu(app))
            .on_menu_event(|app, event| match event.id().as_ref() {
                "blackslate.quit" => {
                    let _ = app.emit("blackslate://confirm-quit", ());
                }
                "blackslate.settings" => {
                    app.emit("blackslate://open-settings", ()).ok();
                }
                _ => {}
            });
    }

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            app.state::<AppState>().sessions.close_all();
        }
    });
}
