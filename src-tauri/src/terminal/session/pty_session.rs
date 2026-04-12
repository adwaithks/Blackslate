//! One PTY-backed shell session: spawn, I/O, resize, Claude detection.

use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use portable_pty::{Child, MasterPty, NativePtySystem, PtySystem};
use tauri::AppHandle;
use tokio::task::JoinHandle;

use crate::terminal::agent_detect;
use crate::terminal::error::{cmd_err, CommandResult};

use super::reader::spawn_reader;
use super::shell::{build_shell_cmd, pty_size, resolve_cwd_path};

pub struct PtySession {
    shell_pid: u32,
    // Mutex required: MasterPty is Send but not Sync; wrapping allows Arc<PtySession>: Sync.
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    reader_task: JoinHandle<()>,
}

impl PtySession {
    /// `cwd` is the UI session working directory (`~`-normalised or absolute); the shell
    /// starts there when the path exists. Otherwise falls back to `$HOME`.
    pub fn new(
        id: String,
        cols: u16,
        rows: u16,
        app: AppHandle,
        cwd: Option<String>,
    ) -> CommandResult<Self> {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

        let pty_system = NativePtySystem::default();

        let pair = pty_system
            .openpty(pty_size(cols, rows))
            .map_err(|e| cmd_err(e))?;

        let cwd_path = cwd
            .as_deref()
            .and_then(resolve_cwd_path)
            .or_else(|| std::env::var("HOME").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/"));
        let cmd = build_shell_cmd(&shell, cwd_path);

        let child = pair.slave.spawn_command(cmd).map_err(|e| cmd_err(e))?;

        // Drop slave after spawn — child holds its own fd reference.
        // Keeping it open would prevent EOF on master when the child exits.
        drop(pair.slave);

        let reader = pair.master.try_clone_reader().map_err(cmd_err)?;
        let writer = pair.master.take_writer().map_err(cmd_err)?;

        let reader_task = spawn_reader(id.clone(), reader, app);

        let shell_pid = child.process_id().unwrap_or(0);

        Ok(PtySession {
            shell_pid,
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Mutex::new(child),
            reader_task,
        })
    }

    pub fn write(&self, data: &[u8]) -> CommandResult<()> {
        self.writer.lock().unwrap().write_all(data).map_err(cmd_err)
    }

    pub fn resize(&self, cols: u16, rows: u16) -> CommandResult<()> {
        self.master
            .lock()
            .unwrap()
            .resize(pty_size(cols, rows))
            .map_err(cmd_err)
    }

    /// True if a Claude Code / `claude` CLI process appears in this PTY's shell tree.
    pub fn claude_code_active(&self) -> bool {
        #[cfg(unix)]
        let fg = {
            let master = self.master.lock().unwrap();
            master
                .process_group_leader()
                .filter(|&p| p > 0)
                .map(|p| p as u32)
        };
        #[cfg(not(unix))]
        let fg: Option<u32> = None;
        agent_detect::claude_session_active(self.shell_pid, fg)
    }

    pub fn close(&self) {
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
        }
        self.reader_task.abort();
    }
}
