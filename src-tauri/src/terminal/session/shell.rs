//! PTY sizing, cwd resolution, and shell `CommandBuilder` (env, login shell, OSC 7 hooks).

use std::path::PathBuf;

use portable_pty::{CommandBuilder, PtySize};

pub(super) fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        cols,
        rows,
        pixel_width: 0,
        pixel_height: 0,
    }
}

/// Map store cwd (`~`, `~/proj`, or absolute) to a real directory for `CommandBuilder::cwd`.
pub(super) fn resolve_cwd_path(raw: &str) -> Option<PathBuf> {
    let p = raw.trim();
    if p.is_empty() {
        return None;
    }
    if p.starts_with('/') {
        let pb = PathBuf::from(p);
        return if pb.is_dir() { Some(pb) } else { None };
    }
    if p == "~" {
        return std::env::var("HOME").ok().map(PathBuf::from);
    }
    if let Some(rest) = p.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            let pb = PathBuf::from(home).join(rest);
            return if pb.is_dir() { Some(pb) } else { None };
        }
    }
    None
}

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
pub(super) fn build_shell_cmd(shell: &str, cwd: PathBuf) -> CommandBuilder {
    let mut cmd = CommandBuilder::new(shell);

    cmd.arg("-l");

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("CLICOLOR", "1");
    cmd.env("CLICOLOR_FORCE", "1");

    for key in &["HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "PATH"] {
        if let Ok(val) = std::env::var(key) {
            cmd.env(key, val);
        }
    }

    let cwd = if cwd.is_dir() {
        cwd
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home)
    } else {
        cwd
    };
    cmd.cwd(cwd);

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
    let zdotdir = std::env::temp_dir().join("blackslate_zsh");
    std::fs::create_dir_all(&zdotdir).ok()?;

    let zprofile = format!(
        r#"# Blackslate shell integration (auto-generated)
[ -f "{home}/.zprofile" ] && source "{home}/.zprofile"
"#
    );

    let zshrc = format!(
        r#"# Blackslate shell integration (auto-generated)
# Source the user's real zshrc first.
[ -f "{home}/.zshrc" ] && source "{home}/.zshrc"

# OSC 7: emit cwd before each prompt so Blackslate can track directory changes.
_blackslate_report_cwd() {{
    printf '\033]7;file://%s%s\a' "${{HOST:-$(hostname)}}" "$PWD"
}}
precmd_functions+=(_blackslate_report_cwd)
_blackslate_report_cwd
"#
    );

    std::fs::write(zdotdir.join(".zprofile"), zprofile).ok()?;
    std::fs::write(zdotdir.join(".zshrc"), zshrc).ok()?;
    Some(zdotdir)
}
