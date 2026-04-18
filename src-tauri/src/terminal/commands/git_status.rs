use crate::terminal::error::CommandResult;
use crate::terminal::resolve_path;
use std::hash::{Hash, Hasher};

#[derive(serde::Serialize, Clone)]
pub struct GitFile {
    pub path: String,
    pub additions: i64, // -1 = binary
    pub deletions: i64,
    /// "modified" | "added" | "deleted" | "renamed"
    pub status: String,
}

#[derive(serde::Serialize)]
pub struct GitStatusResult {
    /// Current branch name (`git rev-parse --abbrev-ref HEAD`).
    pub branch: String,
    pub unstaged: Vec<GitFile>,
    pub staged: Vec<GitFile>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusPollResult {
    pub changed: bool,
    pub hash: String,
    pub status: Option<GitStatusResult>,
}

fn parse_name_status(output: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() < 2 {
            continue;
        }
        let code = parts[0].chars().next().unwrap_or('M');
        // Renames: parts[0]=R100, parts[1]=old path, parts[2]=new path
        let path = if code == 'R' && parts.len() == 3 {
            parts[2].to_string()
        } else {
            parts[1].to_string()
        };
        let status = match code {
            'A' => "added",
            'D' => "deleted",
            'R' => "renamed",
            _ => "modified",
        };
        map.insert(path, status.to_string());
    }
    map
}

fn parse_numstat(output: &str) -> std::collections::HashMap<String, (i64, i64)> {
    let mut map = std::collections::HashMap::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() == 3 {
            let add: i64 = parts[0].parse().unwrap_or(-1);
            let del: i64 = parts[1].parse().unwrap_or(-1);
            map.insert(parts[2].to_string(), (add, del));
        }
    }
    map
}

async fn numstat_untracked(cwd: &str, rel_path: &str) -> (i64, i64) {
    let out = match git_cmd(
        cwd,
        &[
            "diff",
            "--numstat",
            "--no-index",
            "--",
            "/dev/null",
            rel_path,
        ],
    )
    .await
    {
        Ok(o) if o.status.success() => o,
        _ => return (0, 0),
    };
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let line = stdout.lines().next().unwrap_or_default();
    let parts: Vec<&str> = line.splitn(3, '\t').collect();
    if parts.len() < 2 {
        return (0, 0);
    }
    let add = parts[0].parse::<i64>().unwrap_or(-1);
    let del = parts[1].parse::<i64>().unwrap_or(-1);
    (add, del)
}

async fn git_cmd(cwd: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    tokio::process::Command::new("git")
        .args(
            std::iter::once("-C")
                .chain(std::iter::once(cwd))
                .chain(args.iter().copied()),
        )
        .output()
        .await
}

fn hash_status(s: &GitStatusResult) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.branch.hash(&mut hasher);
    for f in &s.unstaged {
        f.path.hash(&mut hasher);
        f.additions.hash(&mut hasher);
        f.deletions.hash(&mut hasher);
        f.status.hash(&mut hasher);
    }
    for f in &s.staged {
        f.path.hash(&mut hasher);
        f.additions.hash(&mut hasher);
        f.deletions.hash(&mut hasher);
        f.status.hash(&mut hasher);
    }
    hasher.finish().to_string()
}

/// Git worktree root for `cwd` (`git rev-parse --show-toplevel`). Canonical path for stable dedup.
#[tauri::command]
pub async fn git_discover_repo_root(cwd: String) -> Option<String> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    let out = git_cmd(&cwd_str, &["rev-parse", "--show-toplevel"])
        .await
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let root = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if root.is_empty() {
        return None;
    }
    match std::fs::canonicalize(&root) {
        Ok(p) => Some(p.to_string_lossy().into_owned()),
        Err(_) => Some(root),
    }
}

/// Returns staged and unstaged file lists with diff stats for the repo containing `cwd`.
#[tauri::command]
pub async fn get_git_status(cwd: String) -> Option<GitStatusResult> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    let check = git_cmd(&cwd_str, &["rev-parse", "--git-dir"]).await.ok()?;
    if !check.status.success() {
        return None;
    }

    let (branch_out, unstaged_out, staged_out, untracked_out, unstaged_ns_out, staged_ns_out) = tokio::join!(
        git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"]),
        git_cmd(&cwd_str, &["diff", "--numstat"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--numstat"]),
        git_cmd(&cwd_str, &["ls-files", "--others", "--exclude-standard"]),
        git_cmd(&cwd_str, &["diff", "--name-status"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--name-status"]),
    );

    let branch = branch_out
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "HEAD".to_string());

    let unstaged_map = unstaged_out
        .ok()
        .map(|o| parse_numstat(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let staged_map = staged_out
        .ok()
        .map(|o| parse_numstat(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let unstaged_ns = unstaged_ns_out
        .ok()
        .map(|o| parse_name_status(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();
    let staged_ns = staged_ns_out
        .ok()
        .map(|o| parse_name_status(&String::from_utf8_lossy(&o.stdout)))
        .unwrap_or_default();

    let mut unstaged: Vec<GitFile> = unstaged_map
        .into_iter()
        .map(|(path, (additions, deletions))| {
            let status = unstaged_ns
                .get(&path)
                .cloned()
                .unwrap_or_else(|| "modified".to_string());
            GitFile {
                path,
                additions,
                deletions,
                status,
            }
        })
        .collect();

    if let Ok(out) = untracked_out {
        for raw in String::from_utf8_lossy(&out.stdout).lines() {
            let path = raw.trim().to_string();
            if path.is_empty() {
                continue;
            }
            let (additions, deletions) = numstat_untracked(&cwd_str, &path).await;
            unstaged.push(GitFile {
                path,
                additions,
                deletions,
                status: "added".to_string(),
            });
        }
    }

    unstaged.sort_by(|a, b| a.path.cmp(&b.path));

    let mut staged: Vec<GitFile> = staged_map
        .into_iter()
        .map(|(path, (additions, deletions))| {
            let status = staged_ns
                .get(&path)
                .cloned()
                .unwrap_or_else(|| "modified".to_string());
            GitFile {
                path,
                additions,
                deletions,
                status,
            }
        })
        .collect();
    staged.sort_by(|a, b| a.path.cmp(&b.path));

    Some(GitStatusResult {
        branch,
        unstaged,
        staged,
    })
}

/// Poll-friendly variant: returns a stable `hash` and `changed` flag. When unchanged, `status` is `None`
/// so the frontend can avoid re-rendering.
#[tauri::command]
pub async fn get_git_status_poll(
    cwd: String,
    prev_hash: Option<String>,
) -> Option<GitStatusPollResult> {
    let status = get_git_status(cwd).await?;
    let hash = hash_status(&status);
    let changed = prev_hash.as_deref() != Some(hash.as_str());
    Some(GitStatusPollResult {
        changed,
        hash,
        status: if changed { Some(status) } else { None },
    })
}

#[tauri::command]
pub async fn stage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn unstage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn discard_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--", &path])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        return Ok(());
    }
    let full = std::path::PathBuf::from(&cwd_str).join(&path);
    std::fs::remove_file(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stage_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "-A"])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn unstage_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "."])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

#[tauri::command]
pub async fn discard_all(cwd: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let (restore_out, clean_out) = tokio::join!(
        git_cmd(&cwd_str, &["restore", "."]),
        git_cmd(&cwd_str, &["clean", "-fd"]),
    );
    let restore_ok = restore_out.map(|o| o.status.success()).unwrap_or(false);
    let clean_ok = clean_out.map(|o| o.status.success()).unwrap_or(false);
    if restore_ok || clean_ok {
        Ok(())
    } else {
        Err("discard_all failed".into())
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GeneratedCommitMessage {
    pub title: String,
    pub description: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPushResult {
    /// Push succeeded.
    pub success: bool,
    /// Push needs a passphrase / password — caller should retry with one.
    pub needs_passphrase: bool,
    /// Human-readable hint shown to the user (e.g. "Enter passphrase for key '~/.ssh/id_rsa'").
    pub passphrase_hint: String,
    /// Branch has no upstream — caller should pass `set_upstream: true` on retry to skip the
    /// redundant first attempt.
    pub needs_upstream: bool,
}

fn write_askpass_script(passphrase: &str) -> std::io::Result<std::path::PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!(
        "blackslate_askpass_{}_{}",
        std::process::id(),
        id
    ));
    // Escape single quotes so the shell echo is safe.
    let safe = passphrase.replace('\'', "'\\''");
    std::fs::write(&path, format!("#!/bin/sh\necho '{}'\n", safe))?;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))?;
    Ok(path)
}

fn push_needs_auth(output: &str) -> bool {
    let o = output.to_lowercase();
    o.contains("permission denied")
        || o.contains("authentication failed")
        || o.contains("could not read username")
        || o.contains("could not read password")
        || o.contains("passphrase")
        || o.contains("invalid username or password")
        || o.contains("fatal: could not read")
        || o.contains("remote: invalid username")
        || o.contains("bad credentials")
}

fn push_needs_upstream(output: &str) -> bool {
    output.contains("has no upstream branch")
        || output.contains("no upstream branch")
        || output.contains("No configured push destination")
        || output.contains("--set-upstream")
        || output.contains("push.default")
}

fn extract_passphrase_hint(output: &str) -> String {
    for line in output.lines() {
        let l = line.to_lowercase();
        if l.contains("passphrase") || l.contains("password") || l.contains("permission denied") {
            return line.trim().to_string();
        }
    }
    "Authentication required".to_string()
}

async fn run_push(
    cwd: &str,
    args: &[&str],
    passphrase: Option<&str>,
) -> std::io::Result<std::process::Output> {
    let full_args: Vec<&str> = std::iter::once("push").chain(args.iter().copied()).collect();
    eprintln!("[blackslate:push] running: git -C {cwd} {}", full_args.join(" "));
    eprintln!("[blackslate:push] passphrase provided: {}", passphrase.is_some());

    let mut cmd = tokio::process::Command::new("git");
    cmd.arg("-C").arg(cwd).arg("push").args(args);

    // Never let git or SSH block waiting for terminal input.
    cmd.stdin(std::process::Stdio::null());
    cmd.env("GIT_TERMINAL_PROMPT", "0");

    let askpass_script = if let Some(pass) = passphrase {
        // Retry with passphrase: use SSH_ASKPASS so SSH reads it non-interactively.
        write_askpass_script(pass).ok()
    } else {
        None
    };

    if let Some(ref script) = askpass_script {
        let script_str = script.to_string_lossy().into_owned();
        eprintln!("[blackslate:push] using askpass script: {script_str}");
        cmd.env("SSH_ASKPASS", &script_str);
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        cmd.env("GIT_ASKPASS", &script_str);
        cmd.env("DISPLAY", ":0");
        // BatchMode=no so SSH calls the askpass script instead of failing immediately.
        cmd.env("GIT_SSH_COMMAND", "ssh -o BatchMode=no -o StrictHostKeyChecking=accept-new");
    } else if passphrase.is_none() {
        // No passphrase: tell SSH to fail immediately instead of prompting.
        // GIT_SSH_COMMAND is the correct way — SSH_BATCH_MODE env var is not read by SSH itself.
        cmd.env("GIT_SSH_COMMAND", "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new");
    }

    let out = cmd.output().await;
    if let Some(script) = askpass_script {
        let _ = std::fs::remove_file(script);
    }
    let out = out?;

    eprintln!("[blackslate:push] exit code: {:?}", out.status.code());
    eprintln!("[blackslate:push] stdout: {}", String::from_utf8_lossy(&out.stdout).trim());
    eprintln!("[blackslate:push] stderr: {}", String::from_utf8_lossy(&out.stderr).trim());
    Ok(out)
}

/// Push the current branch. Automatically retries with `--set-upstream origin <branch>` when
/// needed. Returns `needs_passphrase: true` (instead of an error) when auth is required so the
/// caller can re-invoke with a passphrase. Pass `set_upstream: true` on retry to skip straight
/// to `--set-upstream` when the caller already knows the branch has no upstream.
#[tauri::command]
pub async fn git_push(
    cwd: String,
    passphrase: Option<String>,
    set_upstream: Option<bool>,
) -> CommandResult<GitPushResult> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let pass = passphrase.as_deref();
    let force_upstream = set_upstream.unwrap_or(false);

    eprintln!("[blackslate:push] git_push called for cwd={cwd_str} force_upstream={force_upstream}");

    // If we already know the branch needs --set-upstream, skip the plain push.
    let (out, used_upstream, branch_name) = if force_upstream {
        let branch_out = git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"])
            .await
            .map_err(|e| e.to_string())?;
        let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();
        eprintln!("[blackslate:push] skipping plain push, going straight to --set-upstream origin {branch}");
        let o = run_push(&cwd_str, &["--set-upstream", "origin", &branch], pass)
            .await
            .map_err(|e| e.to_string())?;
        (o, true, branch)
    } else {
        let o = run_push(&cwd_str, &[], pass)
            .await
            .map_err(|e| e.to_string())?;
        (o, false, String::new())
    };

    if out.status.success() {
        eprintln!("[blackslate:push] push succeeded");
        return Ok(GitPushResult {
            success: true,
            needs_passphrase: false,
            passphrase_hint: String::new(),
            needs_upstream: false,
        });
    }

    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
    let combined = format!("{}{}", stdout, stderr);

    eprintln!("[blackslate:push] attempt failed — used_upstream={used_upstream} needs_upstream={} needs_auth={}",
        push_needs_upstream(&combined), push_needs_auth(&combined));

    // Auto-handle missing upstream (only on plain push attempt).
    if !used_upstream && push_needs_upstream(&combined) {
        let branch_out = git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"])
            .await
            .map_err(|e| e.to_string())?;
        let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();
        eprintln!("[blackslate:push] retrying with --set-upstream origin {branch}");

        let out2 = run_push(&cwd_str, &["--set-upstream", "origin", &branch], pass)
            .await
            .map_err(|e| e.to_string())?;

        if out2.status.success() {
            eprintln!("[blackslate:push] push with --set-upstream succeeded");
            return Ok(GitPushResult {
                success: true,
                needs_passphrase: false,
                passphrase_hint: String::new(),
                needs_upstream: false,
            });
        }

        let combined2 = format!(
            "{}{}",
            String::from_utf8_lossy(&out2.stdout),
            String::from_utf8_lossy(&out2.stderr)
        );

        eprintln!("[blackslate:push] --set-upstream also failed — needs_auth={}", push_needs_auth(&combined2));

        if push_needs_auth(&combined2) {
            eprintln!("[blackslate:push] returning needs_passphrase=true needs_upstream=true");
            return Ok(GitPushResult {
                success: false,
                needs_passphrase: true,
                passphrase_hint: extract_passphrase_hint(&combined2),
                needs_upstream: true,
            });
        }

        return Err(combined2.trim().to_string());
    }

    // Auth required on a push that already used --set-upstream → wrong passphrase.
    if push_needs_auth(&combined) {
        eprintln!("[blackslate:push] returning needs_passphrase=true needs_upstream={used_upstream}");
        return Ok(GitPushResult {
            success: false,
            needs_passphrase: true,
            passphrase_hint: extract_passphrase_hint(&combined),
            needs_upstream: used_upstream || !branch_name.is_empty(),
        });
    }

    eprintln!("[blackslate:push] returning error: {}", combined.trim());
    Err(combined.trim().to_string())
}

/// Returns true once setup_zsh_integration() has written the generate-commit script.
#[tauri::command]
pub fn generate_commit_available() -> bool {
    std::env::temp_dir()
        .join("blackslate_zsh")
        .join("blackslate-generate-commit")
        .exists()
}

fn extract_json_object(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end >= start {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}

/// Bodies of ``` fenced blocks in order (skips the optional language token on the opening line).
fn extract_fenced_code_blocks(text: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut rest = text;
    while let Some(open) = rest.find("```") {
        let after_open = &rest[open + 3..];
        let after_first_line = match after_open.find('\n') {
            Some(nl) => &after_open[nl + 1..],
            None => break,
        };
        match after_first_line.find("```") {
            Some(close_idx) => {
                blocks.push(after_first_line[..close_idx].trim().to_string());
                rest = &after_first_line[close_idx + 3..];
            }
            None => break,
        }
    }
    blocks
}

fn parse_generated_commit_message_from_claude_output(
    text: &str,
) -> Result<GeneratedCommitMessage, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("Empty claude output".into());
    }

    if let Some(json_str) = extract_json_object(text) {
        if let Ok(msg) = serde_json::from_str::<GeneratedCommitMessage>(&json_str) {
            if !msg.title.trim().is_empty() {
                return Ok(msg);
            }
        }
    }

    for block in extract_fenced_code_blocks(text) {
        let t = block.trim();
        if !t.starts_with('{') {
            continue;
        }
        if let Ok(msg) = serde_json::from_str::<GeneratedCommitMessage>(t) {
            if !msg.title.trim().is_empty() {
                return Ok(msg);
            }
        }
    }

    let blocks = extract_fenced_code_blocks(text);
    if !blocks.is_empty() {
        let title = blocks[0].trim().to_string();
        let description = blocks
            .get(1)
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if !title.is_empty() {
            return Ok(GeneratedCommitMessage { title, description });
        }
    }

    Err(format!(
        "Could not parse commit message from claude output: {}",
        text
    ))
}

#[tauri::command]
pub async fn git_generate_commit_message(cwd: String) -> CommandResult<GeneratedCommitMessage> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    // Script is written by setup_zsh_integration() at app startup with PATH baked in.
    let script = std::env::temp_dir()
        .join("blackslate_zsh")
        .join("blackslate-generate-commit");

    if !script.exists() {
        return Err(
            "blackslate-generate-commit script not found — please restart the app.".into(),
        );
    }

    let output = tokio::process::Command::new(&script)
        .current_dir(&cwd_str)
        .output()
        .await
        .map_err(|e| format!("Failed to run generate-commit script: {}", e))?;

    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        let msg = format!("{}{}", stdout, stderr).trim().to_string();
        return Err(if msg.is_empty() {
            "claude exited with an error".into()
        } else {
            msg
        });
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    parse_generated_commit_message_from_claude_output(&text)
}

#[tauri::command]
pub async fn git_commit(cwd: String, message: String) -> CommandResult<()> {
    let resolved = resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["commit", "-m", &message])
        .await
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        let combined = format!("{}{}", stdout, stderr).trim().to_string();
        Err(if combined.is_empty() {
            "Commit failed".into()
        } else {
            combined
        })
    }
}

#[cfg(test)]
mod generated_commit_parse_tests {
    use super::*;

    #[test]
    fn parses_bare_json_object() {
        let raw = r#"{"title":"fix: typos","description":"In README."}"#;
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "fix: typos");
        assert_eq!(msg.description, "In README.");
    }

    #[test]
    fn parses_json_with_whitespace_padding() {
        let raw = "  \n{\"title\":\"trim\",\"description\":\"me\"}\n  ";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "trim");
        assert_eq!(msg.description, "me");
    }

    #[test]
    fn parses_json_embedded_in_prose() {
        let raw = "Sure. {\"title\":\"feat: x\",\"description\":\"y\"} Hope this helps.";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "feat: x");
        assert_eq!(msg.description, "y");
    }

    #[test]
    fn parses_minimal_json_empty_description() {
        let raw = r#"{"title":"chore: bump","description":""}"#;
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "chore: bump");
        assert_eq!(msg.description, "");
    }

    #[test]
    fn json_takes_precedence_over_later_fenced_blocks() {
        let raw = r#"{"title":"from json","description":""}
```
ignored title
```
"#;
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "from json");
        assert_eq!(msg.description, "");
    }

    #[test]
    fn falls_back_to_fenced_json_when_leading_braces_are_invalid() {
        let raw = r#"Not JSON: {nope}
```json
{"title":"from fence","description":"body"}
```
"#;
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "from fence");
        assert_eq!(msg.description, "body");
    }

    #[test]
    fn parses_json_in_markdown_fence() {
        let raw = "Here\n```json\n{\"title\":\"a\",\"description\":\"b\"}\n```\n";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "a");
        assert_eq!(msg.description, "b");
    }

    #[test]
    fn parses_title_description_fenced_blocks() {
        let raw = r#"Based on the diff:

**Title:**
```
Refactor git_info to use git subprocesses
```

**Description:**
```
Replace manual walk.
```
"#;
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "Refactor git_info to use git subprocesses");
        assert_eq!(msg.description, "Replace manual walk.");
    }

    #[test]
    fn parses_single_fenced_block_as_title_empty_description() {
        let raw = "```\nonly subject line\n```";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "only subject line");
        assert_eq!(msg.description, "");
    }

    #[test]
    fn parses_three_fenced_blocks_uses_first_two_only() {
        let raw = r"```
first
```
```
second
```
```
third
```
";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "first");
        assert_eq!(msg.description, "second");
    }

    #[test]
    fn multiline_body_in_title_fence() {
        let raw = "```\nline1\nline2\n```";
        let msg = parse_generated_commit_message_from_claude_output(raw).unwrap();
        assert_eq!(msg.title, "line1\nline2");
        assert_eq!(msg.description, "");
    }

    #[test]
    fn err_on_empty_input() {
        let err = parse_generated_commit_message_from_claude_output("").unwrap_err();
        assert_eq!(err, "Empty claude output");
    }

    #[test]
    fn err_on_whitespace_only_input() {
        let err = parse_generated_commit_message_from_claude_output("   \n\t  ").unwrap_err();
        assert_eq!(err, "Empty claude output");
    }

    #[test]
    fn err_on_unparseable_output() {
        let raw = "It looks like your message may have been cut off.";
        let err = parse_generated_commit_message_from_claude_output(raw).unwrap_err();
        assert!(
            err.starts_with("Could not parse commit message from claude output:"),
            "{err}"
        );
        assert!(err.contains("cut off"), "{err}");
    }

    #[test]
    fn rejects_json_with_empty_title_even_if_description_present() {
        let raw = r#"{"title":"","description":"only body"}"#;
        let err = parse_generated_commit_message_from_claude_output(raw).unwrap_err();
        assert!(
            err.starts_with("Could not parse commit message from claude output:"),
            "{err}"
        );
    }

    #[test]
    fn rejects_json_with_whitespace_only_title() {
        let raw = r#"{"title":"   ","description":"x"}"#;
        let err = parse_generated_commit_message_from_claude_output(raw).unwrap_err();
        assert!(
            err.starts_with("Could not parse commit message from claude output:"),
            "{err}"
        );
    }

    #[test]
    fn extract_fenced_skips_language_line() {
        let raw = "```rust\nfn main() {}\n```";
        let blocks = extract_fenced_code_blocks(raw);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0], "fn main() {}");
    }

    #[test]
    fn extract_fenced_multiple_blocks_in_order() {
        let raw = "```\na\n```\n```\nb\n```";
        assert_eq!(extract_fenced_code_blocks(raw), vec!["a", "b"]);
    }

    #[test]
    fn extract_fenced_unclosed_returns_nothing() {
        let raw = "```\nno closing";
        assert!(extract_fenced_code_blocks(raw).is_empty());
    }

    #[test]
    fn extract_fenced_opening_without_newline_returns_nothing() {
        let raw = "```inline";
        assert!(extract_fenced_code_blocks(raw).is_empty());
    }

    #[test]
    fn extract_json_object_grabs_first_to_last_brace() {
        let s = r#"prefix {"title":"x","description":""} suffix"#;
        assert_eq!(
            extract_json_object(s).as_deref(),
            Some(r#"{"title":"x","description":""}"#)
        );
    }
}

#[cfg(test)]
mod push_output_detection_tests {
    use super::extract_passphrase_hint;
    use super::push_needs_auth;
    use super::push_needs_upstream;

    #[test]
    fn needs_upstream_git_messages() {
        assert!(push_needs_upstream(
            "fatal: The current branch feat/x has no upstream branch."
        ));
        assert!(push_needs_upstream(
            "push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin feat/x"
        ));
        assert!(push_needs_upstream(
            "fatal: No configured push destination."
        ));
    }

    #[test]
    fn does_not_need_upstream_on_success_like_stderr() {
        assert!(!push_needs_upstream("Everything up-to-date"));
    }

    #[test]
    fn needs_auth_common_messages() {
        assert!(push_needs_auth(
            "git@github.com: Permission denied (publickey)."
        ));
        assert!(push_needs_auth(
            "remote: Invalid username or password."
        ));
        assert!(push_needs_auth(
            "Enter passphrase for key '/Users/x/.ssh/id_rsa':"
        ));
        assert!(push_needs_auth(
            "Authentication failed for 'https://github.com/org/repo.git/'"
        ));
    }

    #[test]
    fn needs_auth_case_insensitive() {
        assert!(push_needs_auth("Permission DENIED (publickey)."));
    }

    #[test]
    fn passphrase_hint_prefers_matching_line() {
        assert_eq!(
            extract_passphrase_hint(
                "foo\nEnter passphrase for key '/home/u/.ssh/id_ed25519':\nbar"
            ),
            "Enter passphrase for key '/home/u/.ssh/id_ed25519':"
        );
    }

    #[test]
    fn passphrase_hint_fallback_when_no_keyword_line() {
        assert_eq!(extract_passphrase_hint("something weird"), "Authentication required");
    }
}

#[cfg(test)]
mod askpass_script_tests {
    use super::write_askpass_script;

    #[test]
    fn each_askpass_script_gets_a_distinct_path() {
        let a = write_askpass_script("secret-a").unwrap();
        let b = write_askpass_script("secret-b").unwrap();
        assert_ne!(a, b);
        assert!(a.file_name().unwrap().to_string_lossy().contains("blackslate_askpass_"));
        let _ = std::fs::remove_file(&a);
        let _ = std::fs::remove_file(&b);
    }
}

#[cfg(test)]
#[path = "tests/git_status.test.rs"]
mod git_status_tests;
