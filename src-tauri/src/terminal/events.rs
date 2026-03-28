/// Emitted continuously while the PTY session is alive.
/// Payload: base64-encoded raw bytes from the PTY master.
pub fn pty_data(session_id: &str) -> String {
    format!("pty://data/{session_id}")
}

/// Emitted once when the shell process exits (EOF on PTY master read).
/// Payload: unit `()`.
pub fn pty_exit(session_id: &str) -> String {
    format!("pty://exit/{session_id}")
}
