use std::collections::HashMap;

use tauri::AppHandle;

use super::error::CommandResult;
use super::session::PtySession;

/// Owns all active PTY sessions.
///
/// Wrapped in `Mutex<SessionManager>` inside `AppState` and accessed through
/// Tauri's managed-state mechanism.  All methods take `&mut self` so callers
/// must hold the mutex for the duration of the call — keep critical sections
/// short (no I/O inside the lock).
pub struct SessionManager {
    sessions: HashMap<String, PtySession>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: HashMap::new(),
        }
    }

    /// Spawn a new PTY session and register it.
    /// Returns an error if a session with `id` already exists.
    pub fn create(
        &mut self,
        id: String,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> CommandResult<()> {
        if self.sessions.contains_key(&id) {
            return Err(format!("session '{id}' already exists"));
        }
        let session = PtySession::new(id.clone(), cols, rows, app)?;
        self.sessions.insert(id, session);
        Ok(())
    }

    /// Write bytes into the PTY session's stdin.
    pub fn write(&self, id: &str, data: &[u8]) -> CommandResult<()> {
        self.get(id)?.write(data)
    }

    /// Resize the PTY window. Propagates SIGWINCH to the shell.
    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> CommandResult<()> {
        self.get(id)?.resize(cols, rows)
    }

    /// Kill the session and remove it from the map.
    /// Silently succeeds if the session doesn't exist (already closed).
    pub fn close(&mut self, id: &str) {
        if let Some(session) = self.sessions.remove(id) {
            session.close();
        }
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    fn get(&self, id: &str) -> CommandResult<&PtySession> {
        self.sessions
            .get(id)
            .ok_or_else(|| format!("session '{id}' not found"))
    }
}
