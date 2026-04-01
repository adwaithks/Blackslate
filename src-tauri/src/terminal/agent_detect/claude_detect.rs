//! Detect whether Claude Code (or the `claude` CLI) is running in a PTY session.
//! Uses the foreground process group from the PTY (`tcgetpgrp`) plus a descendant walk
//! from the shell PID via `sysinfo` (macOS / Linux).

use std::collections::{HashMap, HashSet};

use sysinfo::{Pid, Process, ProcessesToUpdate, System};

/// `fg_pgid` is the foreground process group from `tcgetpgrp` on the PTY master (Unix).
/// When the user runs an interactive foreground program (e.g. Claude Code), it usually
/// differs from the shell PID and is more reliable than walking only parent pointers.
pub fn claude_session_active(shell_pid: u32, fg_pgid: Option<u32>) -> bool {
    if shell_pid == 0 {
        return false;
    }

    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let shell = Pid::from_u32(shell_pid);
    if sys.process(shell).is_none() {
        return false;
    }

    let children = build_children_map(&sys);

    if let Some(fg) = fg_pgid {
        if fg > 0 && fg != shell_pid {
            let fg = Pid::from_u32(fg);
            if sys.process(fg).is_some() && subtree_has_claude(&sys, &children, fg) {
                return true;
            }
        }
    }

    subtree_has_claude(&sys, &children, shell)
}

fn build_children_map(sys: &System) -> HashMap<Pid, Vec<Pid>> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, proc) in sys.processes() {
        if let Some(parent) = proc.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }
    children
}

fn subtree_has_claude(sys: &System, children: &HashMap<Pid, Vec<Pid>>, root: Pid) -> bool {
    let mut queue = vec![root];
    let mut seen = HashSet::new();

    while let Some(pid) = queue.pop() {
        if !seen.insert(pid) {
            continue;
        }

        if let Some(p) = sys.process(pid) {
            if process_is_claude_code(p) {
                return true;
            }
        }

        if let Some(kids) = children.get(&pid) {
            for &child in kids {
                queue.push(child);
            }
        }
    }

    false
}

fn process_is_claude_code(p: &Process) -> bool {
    let name = p.name().to_string_lossy().to_lowercase();
    if name == "claude" {
        return true;
    }
    if name.contains("claude-code") {
        return true;
    }

    if let Some(exe) = p.exe().and_then(|x| x.to_str()) {
        let e = exe.to_lowercase();
        if e.contains("claude-code") || e.ends_with("/claude") {
            return true;
        }
    }

    let cmd: String = p
        .cmd()
        .iter()
        .map(|s| s.to_string_lossy())
        .collect::<Vec<_>>()
        .join(" ");
    let c = cmd.to_lowercase();

    if cmdline_looks_like_claude(&c) {
        return true;
    }

    if matches!(name.as_str(), "node" | "bun" | "deno") {
        return c.contains("claude-code")
            || c.contains("@anthropic-ai/claude-code")
            || c.contains("@anthropic/claude-code")
            || c.contains("node_modules/.bin/claude")
            || c.contains("node_modules/@anthropic-ai/claude-code")
            || c.contains("/@anthropic-ai/claude-code/");
    }

    false
}

fn cmdline_looks_like_claude(c: &str) -> bool {
    c.contains("claude-code")
        || c.contains("@anthropic/claude-code")
        || c.contains("@anthropic-ai/claude-code")
        || c.contains("/anthropic-ai/claude-code")
        || c.contains("/claude-code/")
}
