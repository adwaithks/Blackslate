use std::io::{Read, Write};
use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

use super::agent_detect;
use super::error::{cmd_err, CommandResult};
use super::events;

pub struct PtySession {
    pub id: String,
    /// PID of the shell process (PTY leader). Used for agent / Claude Code detection.
    pub shell_pid: u32,
    master: Box<dyn MasterPty + Send>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    reader_task: JoinHandle<()>,
}

impl PtySession {
    pub fn new(id: String, cols: u16, rows: u16, app: AppHandle) -> CommandResult<Self> {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        eprintln!("[slate][session] creating id={id} shell={shell} cols={cols} rows={rows}");

        let pty_system = NativePtySystem::default();
        let size = PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system.openpty(size).map_err(|e| {
            eprintln!("[slate][session] openpty failed: {e}");
            cmd_err(e)
        })?;

        let cmd = build_shell_cmd(&shell);
        eprintln!("[slate][session] spawning shell...");

        let child = pair.slave.spawn_command(cmd).map_err(|e| {
            eprintln!("[slate][session] spawn_command failed: {e}");
            cmd_err(e)
        })?;
        eprintln!("[slate][session] shell spawned ok");

        // Drop slave after spawn — child holds its own fd reference.
        // Keeping it open would prevent EOF on master when the child exits.
        drop(pair.slave);

        let reader = pair.master.try_clone_reader().map_err(cmd_err)?;
        let writer = pair.master.take_writer().map_err(cmd_err)?;

        let reader_task = spawn_reader(id.clone(), reader, app);
        eprintln!("[slate][session] reader task started for id={id}");

        let shell_pid = child.process_id().unwrap_or(0);
        eprintln!("[slate][session] shell_pid={shell_pid} id={id}");

        Ok(PtySession {
            id,
            shell_pid,
            master: pair.master,
            writer: Mutex::new(writer),
            child: Mutex::new(child),
            reader_task,
        })
    }

    pub fn write(&self, data: &[u8]) -> CommandResult<()> {
        eprintln!(
            "[slate][session] write {} bytes to id={}",
            data.len(),
            self.id
        );
        self.writer.lock().unwrap().write_all(data).map_err(cmd_err)
    }

    pub fn resize(&self, cols: u16, rows: u16) -> CommandResult<()> {
        eprintln!(
            "[slate][session] resize id={} cols={cols} rows={rows}",
            self.id
        );
        self.master
            .resize(PtySize {
                cols,
                rows,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(cmd_err)
    }

    /// True if a Claude Code / `claude` CLI process appears in this PTY's shell tree.
    pub fn claude_code_active(&self) -> bool {
        #[cfg(unix)]
        let fg = self
            .master
            .process_group_leader()
            .filter(|&p| p > 0)
            .map(|p| p as u32);
        #[cfg(not(unix))]
        let fg: Option<u32> = None;
        agent_detect::claude_session_active(self.shell_pid, fg)
    }

    pub fn close(self) {
        eprintln!("[slate][session] closing id={}", self.id);
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
        }
        self.reader_task.abort();
    }
}

// ---------------------------------------------------------------------------
// Shell command builder
// ---------------------------------------------------------------------------

/// Build a shell `CommandBuilder`.
///
/// ### Why no login shell (-zsh) trick
/// `portable-pty`'s `CommandBuilder` uses `args[0]` as both the executable
/// path passed to `execve` AND the process argv[0]. Setting it to `-zsh`
/// makes it search PATH for a binary literally named `-zsh`, which fails.
///
/// Instead we spawn the shell normally. Since it has a PTY attached,
/// `isatty()` returns true and the shell initialises as interactive,
/// loading `.zshrc` (zsh) / `.bashrc` (bash). Users who need login-shell
/// behaviour (`.zprofile` / `.bash_profile`) can source it from `.zshrc`.
fn build_shell_cmd(shell: &str) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(shell);

    // Essential: programs use $TERM to decide colour / capability support.
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Inherit the user environment from the Tauri process. When launched via
    // `bun tauri dev` this is the full login environment; when launched as a
    // .app bundle we at minimum get the correct HOME/USER.
    for key in &["HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "PATH"] {
        if let Ok(val) = std::env::var(key) {
            cmd.env(key, val);
        }
    }

    // Start in $HOME so the shell prompt is in a sensible directory.
    if let Ok(home) = std::env::var("HOME") {
        cmd.cwd(home);
    }

    // Shell integration: inject OSC 7 cwd reporting so the frontend can
    // track directory changes in real time without modifying user dotfiles.
    if shell.ends_with("zsh") {
        if let Some(zdotdir) = setup_zsh_integration() {
            cmd.env("ZDOTDIR", zdotdir);
        }
    } else if shell.ends_with("bash") {
        let osc7 = r#"printf '\033]7;file://%s%s\a' "${HOSTNAME:-$(hostname)}" "$PWD""#;
        let existing = std::env::var("PROMPT_COMMAND").unwrap_or_default();
        let combined = if existing.is_empty() {
            osc7.to_string()
        } else {
            format!("{existing}; {osc7}")
        };
        cmd.env("PROMPT_COMMAND", combined);
    }

    cmd
}

/// Create a temporary ZDOTDIR containing a `.zshrc` that:
///   1. Sources the user's real `~/.zshrc`
///   2. Appends an OSC 7 precmd hook so zsh reports `$PWD` before each prompt
///
/// Using ZDOTDIR avoids touching the user's dotfiles.
fn setup_zsh_integration() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let zdotdir = std::env::temp_dir().join("slate_zsh");
    std::fs::create_dir_all(&zdotdir).ok()?;

    let zshrc = format!(
        r#"# Slate shell integration (auto-generated)
# Source the user's real zshrc first.
[ -f "{home}/.zshrc" ] && source "{home}/.zshrc"

# OSC 7: emit cwd before each prompt so Slate can track directory changes.
_slate_report_cwd() {{
    printf '\033]7;file://%s%s\a' "${{HOST:-$(hostname)}}" "$PWD"
}}
precmd_functions+=(_slate_report_cwd)
_slate_report_cwd
"#
    );

    std::fs::write(zdotdir.join(".zshrc"), zshrc).ok()?;
    Some(zdotdir)
}

// ---------------------------------------------------------------------------
// PTY reader task
// ---------------------------------------------------------------------------

/// Reads PTY output on a blocking thread and emits Tauri events.
///
/// Uses `spawn_blocking` because `portable-pty`'s reader is synchronous I/O
/// and blocking the async executor would stall all other commands.
fn spawn_reader(
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    app: AppHandle,
) -> JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        eprintln!("[slate][reader] loop start for id={session_id}");
        let mut buf = [0u8; 4096];
        let mut total_bytes = 0usize;

        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    eprintln!(
                        "[slate][reader] EOF/error for id={session_id} total_bytes={total_bytes}"
                    );
                    break;
                }
                Ok(n) => {
                    total_bytes += n;
                    let encoded = B64.encode(&buf[..n]);
                    eprintln!(
                        "[slate][reader] emit {n} bytes (total={total_bytes}) for id={session_id}"
                    );
                    if let Err(e) = app.emit(&events::pty_data(&session_id), encoded) {
                        eprintln!("[slate][reader] emit error: {e}");
                    }
                }
            }
        }

        eprintln!("[slate][reader] emitting exit for id={session_id}");
        app.emit(&events::pty_exit(&session_id), ()).ok();
    })
}
