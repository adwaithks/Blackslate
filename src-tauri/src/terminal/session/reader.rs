//! Blocking PTY reader task: base64 IPC to the frontend, optional session logging.

use std::io::Read;
use std::sync::Arc;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

use crate::terminal::events;
use crate::terminal::logger::SessionLogger;

/// Reads PTY output on a blocking thread and emits each chunk as a Tauri event (base64).
///
/// Uses `spawn_blocking` because `portable-pty`'s reader is synchronous I/O
/// and blocking the async executor would stall all other commands.
pub(super) fn spawn_reader(
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    app: AppHandle,
    logger: Option<Arc<SessionLogger>>,
) -> JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        eprintln!("[blackslate][reader] loop start for id={session_id}");
        let mut buf = [0u8; 4096];

        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    eprintln!("[blackslate][reader] EOF/error for id={session_id}");
                    break;
                }
                Ok(n) => {
                    if let Some(ref l) = logger {
                        l.log_output(&buf[..n]);
                    }
                    app.emit(&events::pty_data(&session_id), B64.encode(&buf[..n]))
                        .ok();
                }
            }
        }

        app.emit(&events::pty_exit(&session_id), ()).ok();
    })
}
