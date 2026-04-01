use std::path::PathBuf;

mod agent_detect;
mod error;
mod events;
pub mod logger;
mod manager;
mod session;

pub mod commands;

use manager::SessionManager;

/// Global application state managed by Tauri.
///
/// `SessionManager` uses internal `RwLock` + `Arc` per session so concurrent
/// writes/resizes across multiple panes don't serialise through a single lock.
pub struct AppState {
    pub sessions: SessionManager,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            sessions: SessionManager::new(),
        }
    }
}

/// Expand a leading `~` to `$HOME`. Shared by `git_info` and other path helpers.
pub(crate) fn resolve_path(cwd: &str) -> PathBuf {
    let mut path = PathBuf::from(cwd);
    if path.starts_with("~") {
        if let Ok(home) = std::env::var("HOME") {
            if !home.is_empty() {
                let rest = path.strip_prefix("~").unwrap().to_path_buf();
                path = PathBuf::from(home).join(rest);
            }
        }
    }
    path
}

// Module name cannot contain `.`; `#[path]` maps this to `tests/resolve_path.test.rs`.
#[cfg(test)]
#[path = "tests/resolve_path.test.rs"]
mod resolve_path_tests;
