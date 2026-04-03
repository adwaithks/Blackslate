//! Per-session PTY logging.
//!
//! Every session writes two files to `~/.blackslate/logs/`:
//!
//!   `<ts>-<short-id>.log`  — human-readable: ANSI-stripped output + labelled user input
//!   `<ts>-<short-id>.raw`  — exact bytes from the PTY master (every escape sequence intact)
//!
//! The `.raw` file is what you feed to an analyser when you need to understand
//! exactly what escape sequences an application (e.g. Claude Code) emits.
//! The `.log` file is what you read normally to follow the conversation.
//!
//! All I/O errors are silently swallowed — logging must never interrupt a session.

use std::fs::{self, File};
use std::io::{BufWriter, Write as _};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub struct SessionLogger {
    log: Mutex<BufWriter<File>>,
    // Raw is unbuffered: chunks are already 4–8 KB from the coalescing reader,
    // so BufWriter adds no value and its buffer gets silently lost on abrupt exit.
    raw: Mutex<File>,
    pub log_path: PathBuf,
    pub raw_path: PathBuf,
}

impl Drop for SessionLogger {
    fn drop(&mut self) {
        if let Ok(mut w) = self.log.lock() {
            let _ = w.flush();
        }
        // raw is unbuffered — nothing to flush.
    }
}

impl SessionLogger {
    /// Create log files for `session_id`. Returns `None` if the log directory
    /// cannot be created or the files cannot be opened — session still works.
    pub fn new(session_id: &str, shell: &str) -> Option<Self> {
        let dir = log_dir()?;
        fs::create_dir_all(&dir).ok()?;

        let prefix = file_prefix(session_id);
        let log_path = dir.join(format!("{prefix}.log"));
        let raw_path = dir.join(format!("{prefix}.raw"));

        let log_file = File::create(&log_path).ok()?;
        let raw_file = File::create(&raw_path).ok()?;

        let mut log = BufWriter::new(log_file);
        // Header — written once so you always know what session a log belongs to.
        writeln!(
            log,
            "# ── Blackslate session log ─────────────────────────────────────────────"
        )
        .ok()?;
        writeln!(log, "# session : {session_id}").ok()?;
        writeln!(log, "# shell   : {shell}").ok()?;
        writeln!(log, "# started : {} UTC", human_ts()).ok()?;
        writeln!(log, "# raw     : {}", raw_path.display()).ok()?;
        writeln!(log, "#").ok()?;
        writeln!(log, "# Timestamps are UTC (HH:MM:SS).").ok()?;
        writeln!(
            log,
            "# OUT lines are PTY output with ANSI stripped (approximate for TUI apps)."
        )
        .ok()?;
        writeln!(
            log,
            "# IN  lines are user keystrokes / pastes sent to the PTY."
        )
        .ok()?;
        writeln!(
            log,
            "# ────────────────────────────────────────────────────────────────────"
        )
        .ok()?;
        writeln!(log).ok()?;

        Some(SessionLogger {
            log: Mutex::new(log),
            raw: Mutex::new(raw_file),
            log_path,
            raw_path,
        })
    }

    /// Log a chunk of PTY output. Called from the reader thread for every read.
    /// Writes the exact bytes to `.raw` and stripped text to `.log`.
    pub fn log_output(&self, bytes: &[u8]) {
        // Raw file — exact bytes, no processing.
        if let Ok(mut w) = self.raw.lock() {
            let _ = w.write_all(bytes);
        }

        // Clean log — strip ANSI, normalise line endings, skip blank-after-strip chunks.
        let text = strip_ansi(bytes);
        if text.chars().any(|c| !c.is_whitespace()) {
            if let Ok(mut w) = self.log.lock() {
                // Prefix the first line; subsequent lines within the chunk are indented.
                let ts = hms();
                let mut first = true;
                for line in text.split('\n') {
                    let trimmed = line.trim_end();
                    if trimmed.is_empty() && !first {
                        continue; // skip blank continuations
                    }
                    if first {
                        let _ = writeln!(w, "[{ts}] OUT {trimmed}");
                        first = false;
                    } else {
                        let _ = writeln!(w, "           {trimmed}");
                    }
                }
                let _ = w.flush();
            }
        }
    }

    /// Log bytes the user sent to the PTY (keystrokes, pastes, Enter).
    /// Makes control characters visible so you can see exactly what was sent.
    pub fn log_input(&self, data: &[u8]) {
        // Represent each byte visibly so the log is unambiguous.
        let repr: String = data
            .iter()
            .map(|&b| match b {
                b'\r' | b'\n' => "↵".to_string(),
                b'\t' => "⇥".to_string(),
                0x1b => "ESC".to_string(),
                0x03 => "^C".to_string(),
                0x04 => "^D".to_string(),
                0x7f => "⌫".to_string(),
                b if b >= 0x20 && b < 0x7f => (b as char).to_string(),
                b => format!("\\x{b:02x}"),
            })
            .collect();

        // Only log if there's something meaningful (skip pure mouse/resize reports).
        if repr.is_empty() || repr.chars().all(|c| c == ' ') {
            return;
        }

        if let Ok(mut w) = self.log.lock() {
            let _ = writeln!(w, "[{}]  IN  {repr}", hms());
            let _ = w.flush();
        }
    }

    pub fn close(&self) {
        if let Ok(mut w) = self.log.lock() {
            let _ = writeln!(w, "\n[{}] === session closed ===", hms());
            let _ = w.flush();
        }
        // raw is unbuffered — File writes go straight to the kernel.
    }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// `~/.blackslate` — shared root for logs, workspace layout, and future dotfiles.
pub fn blackslate_data_root() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".blackslate"))
}

pub fn log_dir() -> Option<PathBuf> {
    blackslate_data_root().map(|p| p.join("logs"))
}

fn file_prefix(session_id: &str) -> String {
    let unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let short = &session_id[..8.min(session_id.len())];
    format!("{unix}-{short}")
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/// `HH:MM:SS` in UTC derived from `SystemTime` — no external crate required.
fn hms() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let day_secs = secs % 86_400;
    format!(
        "{:02}:{:02}:{:02}",
        day_secs / 3600,
        (day_secs % 3600) / 60,
        day_secs % 60,
    )
}

/// Human-readable `YYYY-MM-DD HH:MM:SS` (UTC, approximate — no date crate).
fn human_ts() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Days since epoch → Gregorian date via algorithm (handles leap years correctly).
    let days = secs / 86_400;
    let day_secs = secs % 86_400;
    let (y, m, d) = days_to_ymd(days);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}",
        day_secs / 3600,
        (day_secs % 3600) / 60,
        day_secs % 60,
    )
}

/// Convert days-since-Unix-epoch to (year, month, day). Algorithm: civil calendar.
fn days_to_ymd(z: u64) -> (u64, u64, u64) {
    let z = z + 719_468;
    let era = z / 146_097;
    let doe = z % 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

// ---------------------------------------------------------------------------
// ANSI escape sequence stripper
// ---------------------------------------------------------------------------
//
// State-machine that understands the most common VT/ANSI/xterm sequences.
// Not a full VT emulator — it strips control sequences and returns the visible
// text layer, which is good enough for log readability. TUI apps that use
// cursor movement to overwrite lines will produce somewhat noisy output; read
// the `.raw` file for those sessions.

fn strip_ansi(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            // ── ESC — start of escape sequence ──────────────────────────────
            0x1b => {
                i += 1;
                if i >= bytes.len() {
                    break;
                }
                match bytes[i] {
                    // CSI: ESC [ <param bytes 0x30–0x3f> <intermediate 0x20–0x2f>* <final 0x40–0x7e>
                    b'[' => {
                        i += 1;
                        while i < bytes.len() && !(bytes[i] >= 0x40 && bytes[i] <= 0x7e) {
                            i += 1;
                        }
                        if i < bytes.len() {
                            i += 1; // consume final byte
                        }
                    }
                    // OSC: ESC ] <text> ST(ESC \) or BEL
                    b']' => {
                        i += 1;
                        while i < bytes.len() {
                            if bytes[i] == 0x07 {
                                i += 1;
                                break;
                            }
                            if bytes[i] == 0x1b {
                                if i + 1 < bytes.len() && bytes[i + 1] == b'\\' {
                                    i += 2;
                                } else {
                                    i += 1;
                                }
                                break;
                            }
                            i += 1;
                        }
                    }
                    // DCS / SOS / PM / APC — terminated by ST
                    b'P' | b'X' | b'^' | b'_' => {
                        i += 1;
                        while i < bytes.len() {
                            if bytes[i] == 0x1b && i + 1 < bytes.len() && bytes[i + 1] == b'\\' {
                                i += 2;
                                break;
                            }
                            i += 1;
                        }
                    }
                    // Character-set designators: ESC ( G, ESC ) G, etc.
                    b'(' | b')' | b'*' | b'+' => {
                        i += 1;
                        if i < bytes.len() {
                            i += 1; // skip designator character
                        }
                    }
                    // All other two-character ESC sequences (ESC c, ESC M, …)
                    _ => {
                        i += 1;
                    }
                }
            }

            // ── Carriage return ──────────────────────────────────────────────
            // \r\n → single newline; lone \r → newline (overwrite lines become
            // separate log lines, which is slightly noisy but captures content).
            b'\r' => {
                if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                    out.push('\n');
                    i += 2;
                } else {
                    out.push('\n');
                    i += 1;
                }
            }

            b'\n' => {
                out.push('\n');
                i += 1;
            }

            b'\t' => {
                out.push('\t');
                i += 1;
            }

            // Strip all other C0/C1 control characters.
            b if b < 0x20 || b == 0x7f => {
                i += 1;
            }

            // ── Printable / UTF-8 multibyte ──────────────────────────────────
            b => {
                let w = utf8_width(b);
                if i + w <= bytes.len() {
                    if let Ok(s) = std::str::from_utf8(&bytes[i..i + w]) {
                        out.push_str(s);
                    }
                }
                i += w.max(1);
            }
        }
    }

    out
}

fn utf8_width(b: u8) -> usize {
    match b {
        b if b < 0x80 => 1,
        b if b < 0xc0 => 1, // unexpected continuation — skip
        b if b < 0xe0 => 2,
        b if b < 0xf0 => 3,
        _ => 4,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_color_codes() {
        let input = b"\x1b[32mHello\x1b[0m world";
        assert_eq!(strip_ansi(input), "Hello world");
    }

    #[test]
    fn strips_osc7() {
        let input = b"text\x1b]7;file:///Users/kannan\x07more";
        assert_eq!(strip_ansi(input), "textmore");
    }

    #[test]
    fn strips_cursor_movement() {
        let input = b"\x1b[2J\x1b[Hcontent";
        assert_eq!(strip_ansi(input), "content");
    }

    #[test]
    fn normalises_crlf() {
        let input = b"line1\r\nline2\rline3";
        assert_eq!(strip_ansi(input), "line1\nline2\nline3");
    }

    #[test]
    fn passes_through_utf8() {
        let input = "こんにちは".as_bytes();
        assert_eq!(strip_ansi(input), "こんにちは");
    }

    #[test]
    fn date_roundtrip() {
        // 2024-03-28 = days 19810 since epoch
        let (y, m, d) = days_to_ymd(19810);
        assert_eq!((y, m, d), (2024, 3, 28));
    }
}
