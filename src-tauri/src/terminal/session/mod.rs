//! PTY session lifecycle: one shell per `PtySession`, with optional file logging and a blocking reader task.

mod pty_session;
mod reader;
mod shell;

pub use pty_session::PtySession;
