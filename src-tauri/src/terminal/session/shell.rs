//! PTY sizing, cwd resolution, and shell `CommandBuilder` (env, login shell, zsh integration).

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
    }

    cmd
}

/// Create a temporary ZDOTDIR containing a `.zshrc` that:
///   1. Sources the user's real `~/.zshrc`
///   2. Appends OSC 7 / OSC 6973 shell hooks for cwd + running/idle tracking
///      (`precmd` + `chpwd` so `cd foo && long-running-cmd` updates cwd before the cmd blocks)
///   3. Wraps the `claude` binary to inject UserPromptSubmit/Stop hooks that
///      emit OSC 6974 sequences so Blackslate can track thinking vs waiting state
///
/// Using ZDOTDIR avoids touching the user's dotfiles.
fn setup_zsh_integration() -> Option<std::path::PathBuf> {
    use std::os::unix::fs::PermissionsExt;

    let home = std::env::var("HOME").ok()?;
    let zdotdir = std::env::temp_dir().join("blackslate_zsh");
    std::fs::create_dir_all(&zdotdir).ok()?;

    // Hook scripts — Claude Code runs these as subprocesses; they write OSC sequences
    // directly to /dev/tty (the controlling PTY) so Blackslate sees them in the stream.
    //
    //  blackslate-thinking  UserPromptSubmit + PreToolUse
    //                  OSC 6974;thinking  — start pulsing
    //
    //  blackslate-waiting   Notification
    //                  OSC 6974;waiting   — pause pulse
    //
    //  blackslate-complete  Stop
    //                  OSC 6974;complete  — stop pulsing
    //                  OSC 6977;{model}   — optional model refresh from transcript (latest end_turn)
    //
    //  blackslate-session-start  SessionStart
    //                  OSC 6977;{model}  — API model id from hook JSON (startup / resume / clear / compact)
    //
    //  blackslate-cwd-changed  CwdChanged
    //                  OSC 7 (file://…) — same as zsh precmd; Claude `cd` without a new shell prompt

    // blackslate-session-start: Python — SessionStart JSON includes `model` when Claude provides it.
    let hook_session_start = zdotdir.join("blackslate-session-start");
    std::fs::write(
        &hook_session_start,
        r#"#!/usr/bin/env python3
import sys, json

try:
    d = json.load(sys.stdin)
    model = d.get("model") or ""
    if isinstance(model, str) and model:
        safe = "".join(c for c in model if c not in "\x07\x1b;")
        if safe:
            with open("/dev/tty", "wb", buffering=0) as tty:
                tty.write(("\033]6977;" + safe + "\007").encode())
except Exception:
    pass
"#,
    )
    .ok()?;
    std::fs::set_permissions(
        &hook_session_start,
        std::fs::Permissions::from_mode(0o755),
    )
    .ok()?;

    // blackslate-cwd-changed: Python — CwdChanged provides new_cwd; emit OSC 7 for existing PTY parser.
    let hook_cwd_changed = zdotdir.join("blackslate-cwd-changed");
    std::fs::write(
        &hook_cwd_changed,
        r#"#!/usr/bin/env python3
import json
import os
import sys

try:
    d = json.load(sys.stdin)
    raw = d.get("new_cwd") or ""
    if not isinstance(raw, str) or not raw.startswith("/"):
        sys.exit(0)
    path = "".join(c for c in raw if ord(c) >= 32 and c not in "\x07\x1b")
    if not path.startswith("/"):
        sys.exit(0)
    host = os.uname().nodename
    host = "".join(c for c in host if ord(c) >= 32 and c not in "\x07\x1b")
    payload = "file://" + host + path
    with open("/dev/tty", "wb", buffering=0) as tty:
        tty.write(("\033]7;" + payload + "\007").encode())
except Exception:
    pass
"#,
    )
    .ok()?;
    std::fs::set_permissions(
        &hook_cwd_changed,
        std::fs::Permissions::from_mode(0o755),
    )
    .ok()?;

    // blackslate-thinking: Python — UserPromptSubmit + PreToolUse; emit thinking only.
    let hook_thinking = zdotdir.join("blackslate-thinking");
    std::fs::write(
        &hook_thinking,
        r#"#!/usr/bin/env python3
import sys

with open('/dev/tty', 'wb', buffering=0) as tty:
    tty.write(b'\033]6974;thinking\007')
# Drain stdin so Claude's hook runner does not block on a full pipe.
try:
    sys.stdin.read()
except Exception:
    pass
"#,
    )
    .ok()?;

    // blackslate-waiting: simple shell — pause pulse.
    let hook_waiting = zdotdir.join("blackslate-waiting");
    std::fs::write(&hook_waiting, "#!/bin/sh\nprintf '\\033]6974;waiting\\007' >/dev/tty\n").ok()?;

    // blackslate-complete: Python — emits complete + optionally refreshes model from transcript.
    // The Stop hook can fire before the final `end_turn` row is flushed to the JSONL
    // transcript, so we sleep 1s first, then read `model` from the latest end_turn row.
    let hook_complete = zdotdir.join("blackslate-complete");
    std::fs::write(
        &hook_complete,
        r#"#!/usr/bin/env python3
import sys, json, os, time

with open('/dev/tty', 'wb', buffering=0) as tty:
    tty.write(b'\033]6974;complete\007')
    try:
        d = json.load(sys.stdin)
        tp = d.get('transcript_path', '')
        if tp:
            def emit_model(msg):
                model = msg.get('model', '')
                if not isinstance(model, str) or not model:
                    return False
                safe = ''.join(c for c in model if c not in '\x07\x1b;')
                if not safe:
                    return False
                tty.write(('\033]6977;' + safe + '\007').encode())
                return True

            time.sleep(1)
            with open(os.path.expanduser(tp)) as f:
                lines = f.readlines()

            for line in reversed(lines):
                try:
                    obj = json.loads(line)
                    msg = obj.get('message') or obj
                    if msg.get('role') != 'assistant':
                        continue
                    if msg.get('stop_reason') == 'end_turn':
                        emit_model(msg)
                        break
                except Exception:
                    continue
    except Exception:
        pass
"#,
    )
    .ok()?;

    std::fs::set_permissions(&hook_thinking, std::fs::Permissions::from_mode(0o755)).ok()?;
    std::fs::set_permissions(&hook_waiting, std::fs::Permissions::from_mode(0o755)).ok()?;
    std::fs::set_permissions(&hook_complete, std::fs::Permissions::from_mode(0o755)).ok()?;

    // blackslate-generate-commit: invoked by the Rust backend to generate a commit message.
    // Bakes in the current PATH so the Tauri process can call it directly without PATH lookup.
    let path_env = std::env::var("PATH").unwrap_or_default();
    let hook_generate_commit = zdotdir.join("blackslate-generate-commit");
    std::fs::write(
        &hook_generate_commit,
        format!(
            "#!/bin/sh\n\
             export PATH='{path_env}'\n\
             exec claude -p \
             'Generate a commit message for the staged changes. Run git log --oneline -10 and match how those commits are written. Output only one JSON object: {{\"title\":\"subject\",\"description\":\"\"}}. Use a non-empty description only when a short body helps; otherwise use an empty string for description. No other text, no markdown, no code fences.' \
             --output-format text\n"
        ),
    )
    .ok()?;
    std::fs::set_permissions(
        &hook_generate_commit,
        std::fs::Permissions::from_mode(0o755),
    )
    .ok()?;

    let zdotdir_str = zdotdir.to_string_lossy();

    let zprofile = format!(
        r#"# Blackslate shell integration (auto-generated)
[ -f "{home}/.zprofile" ] && source "{home}/.zprofile"
"#
    );

    let zshrc = format!(
        r#"# Blackslate shell integration (auto-generated)
# Source the user's real zshrc first.
[ -f "{home}/.zshrc" ] && source "{home}/.zshrc"

# OSC 7: emit cwd on each prompt and whenever $PWD changes (e.g. `cd dir && npm start`
# updates the UI after `cd`, not only when the foreground job exits).
_blackslate_report_cwd() {{
    printf '\033]7;file://%s%s\a' "${{HOST:-$(hostname)}}" "$PWD"
}}
precmd_functions+=(_blackslate_report_cwd)
chpwd_functions+=(_blackslate_report_cwd)
_blackslate_report_cwd

# Shell state tracking: OSC 6973 signals running vs idle.
_blackslate_report_running() {{
    printf '\033]6973;running\a'
}}
_blackslate_report_idle() {{
    printf '\033]6973;prompt\a'
}}
preexec_functions+=(_blackslate_report_running)
precmd_functions+=(_blackslate_report_idle)

# Claude Code hook injection: wrap `claude` to inject UserPromptSubmit/Stop hooks
# that emit OSC 6974 so Blackslate can track thinking vs waiting state.
# Uses `command claude` inside the function to call the real binary, not this wrapper.
claude() {{
    case "${{1:-}}" in
        mcp|config|api-key|doctor|update) command claude "$@"; return ;;
    esac
    local _hooks='{{"hooks":{{"SessionStart":[{{"matcher":"","hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-session-start","timeout":5}}]}}],"CwdChanged":[{{"hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-cwd-changed","timeout":5}}]}}],"UserPromptSubmit":[{{"matcher":"","hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-thinking","timeout":5}}]}}],"PreToolUse":[{{"matcher":"","hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-thinking","timeout":5,"run_in_background":true}}]}}],"Notification":[{{"matcher":"","hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-waiting","timeout":5}}]}}],"Stop":[{{"matcher":"","hooks":[{{"type":"command","command":"{zdotdir_str}/blackslate-complete","timeout":5}}]}}]}}}}'
    command claude --settings "$_hooks" "$@"
}}
"#
    );

    std::fs::write(zdotdir.join(".zprofile"), zprofile).ok()?;
    std::fs::write(zdotdir.join(".zshrc"), zshrc).ok()?;
    Some(zdotdir)
}
