use std::sync::Mutex;

mod error;
mod events;
mod manager;
mod session;

pub mod commands;

use manager::SessionManager;

/// Global application state managed by Tauri.
///
/// Accessed in command handlers via `State<'_, AppState>`.
/// The `Mutex` ensures exclusive access when creating or closing sessions.
/// Individual session operations (write, resize) use their own internal
/// per-field mutexes so they don't block each other.
pub struct AppState {
    pub sessions: Mutex<SessionManager>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            sessions: Mutex::new(SessionManager::new()),
        }
    }
}
