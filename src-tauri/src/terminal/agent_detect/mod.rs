//! Foreground agent detection for PTY sessions.
//!
//! Add per-agent modules (e.g. `claude_detect`) and compose or dispatch from session code.

pub mod claude_detect;

pub use claude_detect::claude_session_active;
