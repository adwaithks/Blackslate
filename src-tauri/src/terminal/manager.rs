use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use tauri::AppHandle;

use super::error::CommandResult;
use super::session::PtySession;

/// Owns all active PTY sessions.
///
/// Uses `RwLock<HashMap<…, Arc<PtySession>>>` so concurrent operations on
/// different sessions (writes, resizes, agent checks) can proceed in parallel.
/// Only `create` and `close` briefly take the write lock to mutate the map;
/// all other operations take the read lock just long enough to clone the `Arc`,
/// then release it before doing any I/O.
pub struct SessionManager {
    sessions: RwLock<HashMap<String, Arc<PtySession>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: RwLock::new(HashMap::new()),
        }
    }

    /// Spawn a new PTY session and register it.
    /// Returns an error if a session with `id` already exists.
    pub fn create(
        &self,
        id: String,
        cols: u16,
        rows: u16,
        cwd: Option<String>,
        app: AppHandle,
    ) -> CommandResult<()> {
        // Spawn outside the lock — PTY creation can block for a moment.
        // Re-check for duplicates atomically at insert time.
        if self.sessions.read().unwrap().contains_key(&id) {
            return Err(format!("session '{id}' already exists"));
        }
        let session = Arc::new(PtySession::new(id.clone(), cols, rows, app, cwd)?);
        let mut map = self.sessions.write().unwrap();
        if map.contains_key(&id) {
            return Err(format!("session '{id}' already exists"));
        }
        map.insert(id, session);
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
    pub fn close(&self, id: &str) {
        if let Some(session) = self.sessions.write().unwrap().remove(id) {
            session.close();
        }
    }

    /// Kill every PTY (shell child + reader task). Used on app exit so processes are not left
    /// running when the parent process terminates.
    pub fn close_all(&self) {
        let mut map = self.sessions.write().unwrap();
        for (_, session) in map.drain() {
            session.close();
        }
    }

    /// Whether Claude Code (or the `claude` CLI) is running under this PTY's shell.
    pub fn claude_code_active(&self, id: &str) -> CommandResult<bool> {
        Ok(self.get(id)?.claude_code_active())
    }

    /// Returns `(log_path, raw_path)` for the session, or `None` if not found.
    pub fn get_paths(&self, id: &str) -> Option<(Option<String>, Option<String>)> {
        let session = self.get(id).ok()?;
        Some((session.log_path(), session.raw_path()))
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /// Clone the `Arc` for `id`, releasing the read lock before any I/O.
    fn get(&self, id: &str) -> CommandResult<Arc<PtySession>> {
        self.sessions
            .read()
            .unwrap()
            .get(id)
            .cloned()
            .ok_or_else(|| format!("session '{id}' not found"))
    }
}
