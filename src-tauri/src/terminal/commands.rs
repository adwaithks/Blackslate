use tauri::{AppHandle, State};

use super::error::CommandResult;
use super::logger;
use super::project_stack::{self as project_stack_mod, ProjectStackItem};
use super::AppState;

#[tauri::command]
pub fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_default()
}

#[tauri::command]
pub async fn pty_create(
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_create id={id} cols={cols} rows={rows} cwd={cwd:?}");
    let result = state.sessions.create(id.clone(), cols, rows, cwd, app);
    match &result {
        Ok(_) => eprintln!("[blackslate][cmd] pty_create ok id={id}"),
        Err(e) => eprintln!("[blackslate][cmd] pty_create err id={id}: {e}"),
    }
    result
}

#[tauri::command]
pub async fn pty_write(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    // Don't log every keystroke — only log if it errors.
    let result = state.sessions.write(&id, data.as_bytes());
    if let Err(ref e) = result {
        eprintln!("[blackslate][cmd] pty_write err id={id}: {e}");
    }
    result
}

#[tauri::command]
pub async fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_resize id={id} cols={cols} rows={rows}");
    state.sessions.resize(&id, cols, rows)
}

#[tauri::command]
pub async fn pty_close(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<()> {
    eprintln!("[blackslate][cmd] pty_close id={id}");
    state.sessions.close(&id);
    Ok(())
}

#[tauri::command]
pub async fn pty_claude_code_active(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<bool> {
    state.sessions.claude_code_active(&id)
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/// Returns the path to the session log directory (`~/.blackslate/logs`).
/// Use this to know where to find `.log` and `.raw` files.
#[tauri::command]
pub fn get_log_dir() -> Option<String> {
    logger::log_dir().map(|p| p.to_string_lossy().into_owned())
}

/// Returns the log and raw file paths for a given PTY session id.
/// Both are `None` when logging was unavailable (e.g. permission error).
#[derive(serde::Serialize)]
pub struct SessionPaths {
    pub log: Option<String>,
    pub raw: Option<String>,
}

#[tauri::command]
pub fn pty_session_paths(id: String, state: State<'_, AppState>) -> SessionPaths {
    match state.sessions.get_paths(&id) {
        Some((log, raw)) => SessionPaths { log, raw },
        None => SessionPaths { log: None, raw: None },
    }
}

// ---------------------------------------------------------------------------
// Git info
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct GitInfo {
    pub branch: String,
    pub dirty: bool,
}

/// Walk up from `cwd` to find `.git/HEAD`, parse the branch, and check dirty
/// status. Returns `None` when not inside a git repository.
///
/// Branch is read directly from the file (no subprocess, zero overhead).
/// Dirty status spawns `git status --porcelain` asynchronously so the tokio
/// worker thread is not blocked.
#[tauri::command]
pub async fn git_info(cwd: String) -> Option<GitInfo> {
    let mut search = super::resolve_path(&cwd);

    loop {
        let head = search.join(".git").join("HEAD");
        if head.is_file() {
            let content = std::fs::read_to_string(&head).ok()?;
            let content = content.trim().to_string();

            let branch = if let Some(b) = content.strip_prefix("ref: refs/heads/") {
                b.to_string()
            } else if content.len() >= 7 {
                format!("({}…)", &content[..7]) // detached HEAD
            } else {
                return None;
            };

            let cwd_str = search.to_string_lossy().into_owned();
            let dirty = tokio::process::Command::new("git")
                .args(["-C", &cwd_str, "status", "--porcelain"])
                .output()
                .await
                .map(|o| o.status.success() && !o.stdout.is_empty())
                .unwrap_or(false);

            return Some(GitInfo { branch, dirty });
        }
        if !search.pop() {
            break;
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Git status / staging
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct GitFile {
    pub path: String,
    pub additions: i64, // -1 = binary
    pub deletions: i64,
}

#[derive(serde::Serialize)]
pub struct GitStatusResult {
    /// Current branch name (`git rev-parse --abbrev-ref HEAD`).
    pub branch: String,
    pub unstaged: Vec<GitFile>,
    pub staged: Vec<GitFile>,
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

/// Line stats for an untracked path (`git diff` omits these). Uses `git diff --no-index` against `/dev/null`.
async fn numstat_untracked(cwd: &str, rel_path: &str) -> (i64, i64) {
    let out = match git_cmd(
        cwd,
        &["diff", "--numstat", "--no-index", "--", "/dev/null", rel_path],
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
        .args(std::iter::once("-C").chain(std::iter::once(cwd)).chain(args.iter().copied()))
        .output()
        .await
}

/// Git worktree root for `cwd` (`git rev-parse --show-toplevel`). Canonical path for stable dedup.
#[tauri::command]
pub async fn git_discover_repo_root(cwd: String) -> Option<String> {
    let resolved = super::resolve_path(&cwd);
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
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();

    // Bail early if not in a git repo
    let check = git_cmd(&cwd_str, &["rev-parse", "--git-dir"]).await.ok()?;
    if !check.status.success() {
        return None;
    }

    let (branch_out, unstaged_out, staged_out, untracked_out) = tokio::join!(
        git_cmd(&cwd_str, &["rev-parse", "--abbrev-ref", "HEAD"]),
        git_cmd(&cwd_str, &["diff", "--numstat"]),
        git_cmd(&cwd_str, &["diff", "--cached", "--numstat"]),
        git_cmd(&cwd_str, &["ls-files", "--others", "--exclude-standard"]),
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

    let mut unstaged: Vec<GitFile> = unstaged_map
        .into_iter()
        .map(|(path, (additions, deletions))| GitFile { path, additions, deletions })
        .collect();

    // Append untracked files — `git diff --numstat` omits them; use --no-index vs /dev/null.
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
            });
        }
    }

    unstaged.sort_by(|a, b| a.path.cmp(&b.path));

    let mut staged: Vec<GitFile> = staged_map
        .into_iter()
        .map(|(path, (additions, deletions))| GitFile { path, additions, deletions })
        .collect();
    staged.sort_by(|a, b| a.path.cmp(&b.path));

    Some(GitStatusResult {
        branch,
        unstaged,
        staged,
    })
}

#[tauri::command]
pub async fn stage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn unstage_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn discard_file(cwd: String, path: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    // Try restore first (tracked files); fall back to removing untracked file
    let out = git_cmd(&cwd_str, &["restore", "--", &path]).await.map_err(|e| e.to_string())?;
    if out.status.success() {
        return Ok(());
    }
    let full = std::path::PathBuf::from(&cwd_str).join(&path);
    std::fs::remove_file(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stage_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["add", "-A"]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn unstage_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let out = git_cmd(&cwd_str, &["restore", "--staged", "."]).await.map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).into_owned()) }
}

#[tauri::command]
pub async fn discard_all(cwd: String) -> CommandResult<()> {
    let resolved = super::resolve_path(&cwd);
    let cwd_str = resolved.to_string_lossy().into_owned();
    let (restore_out, clean_out) = tokio::join!(
        git_cmd(&cwd_str, &["restore", "."]),
        git_cmd(&cwd_str, &["clean", "-fd"]),
    );
    let restore_ok = restore_out.map(|o| o.status.success()).unwrap_or(false);
    let clean_ok = clean_out.map(|o| o.status.success()).unwrap_or(false);
    if restore_ok || clean_ok { Ok(()) } else { Err("discard_all failed".into()) }
}

// ---------------------------------------------------------------------------
// Native folder picker (macOS)
// ---------------------------------------------------------------------------

/// Opens a native macOS folder picker (multiple-select) via osascript.
/// Returns the selected POSIX paths, or an empty vec on cancel / error.
#[tauri::command]
pub async fn pick_folders() -> Vec<String> {
    // AppleScript: on cancel the error handler returns empty string so we
    // never propagate an error to the frontend.
    let script = r#"try
    set theChosenFolders to choose folder with prompt "Select git repositories:" with multiple selections allowed
    set output to ""
    repeat with aFolder in theChosenFolders
        set output to output & POSIX path of aFolder & "\n"
    end repeat
    return output
on error
    return ""
end try"#;

    let result = tokio::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .await;

    match result {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout).into_owned();
            raw.lines()
                .map(|l| l.trim().trim_end_matches('/').to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        Err(_) => vec![],
    }
}

// ---------------------------------------------------------------------------
// Project stack
// ---------------------------------------------------------------------------

/// Detect project stacks (Rust, Go, Node, React, Python, …) at the nearest project root.
#[tauri::command]
pub async fn project_stack(cwd: String) -> Vec<ProjectStackItem> {
    project_stack_mod::detect(cwd)
}

// ---------------------------------------------------------------------------
// Claude Code session browser
// ---------------------------------------------------------------------------

/// Summary of a single Claude Code conversation session extracted from the
/// `~/.claude/projects/<encoded-path>/<uuid>.jsonl` files.
#[derive(serde::Serialize)]
pub struct ClaudeSessionSummary {
    pub session_id: String,
    pub timestamp: String,
    pub cwd: String,
    pub git_branch: Option<String>,
    /// First ~120 chars of the opening user message.
    pub summary: String,
}

/// Reads all Claude Code session JSONL files for the given `cwd` and returns
/// them sorted newest-first. Mirrors what `claude /resume` does internally.
#[tauri::command]
pub async fn list_claude_sessions(cwd: String) -> Vec<ClaudeSessionSummary> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return vec![],
    };

    // Claude encodes the project path by replacing every '/' with '-'.
    // e.g. /Users/kannan/Projects/Slate → -Users-kannan-Projects-Slate
    let resolved = super::resolve_path(&cwd);
    let abs_cwd = resolved.to_string_lossy().into_owned();
    let project_key = abs_cwd.replace('/', "-");

    let sessions_dir = std::path::PathBuf::from(&home)
        .join(".claude")
        .join("projects")
        .join(&project_key);

    if !sessions_dir.is_dir() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&sessions_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut sessions = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Find the first user message with no parent (the conversation opener).
        for line in content.lines() {
            let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };

            if obj.get("type").and_then(|v| v.as_str()) != Some("user") {
                continue;
            }
            // parentUuid must be null / absent
            if obj.get("parentUuid").map(|v| !v.is_null()).unwrap_or(false) {
                continue;
            }

            let session_id = obj
                .get("sessionId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if session_id.is_empty() {
                break;
            }

            let timestamp = obj
                .get("timestamp")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let session_cwd = obj
                .get("cwd")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let git_branch = obj
                .get("gitBranch")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Content is either a plain string or an array of {type, text} blocks.
            let raw = if let Some(mc) = obj.get("message").and_then(|m| m.get("content")) {
                if let Some(s) = mc.as_str() {
                    s.to_string()
                } else if let Some(arr) = mc.as_array() {
                    arr.iter()
                        .filter_map(|c| c.get("text").and_then(|t| t.as_str()))
                        .collect::<Vec<_>>()
                        .join(" ")
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            // Strip the <local-command-caveat>…</local-command-caveat> wrapper that
            // Claude Code prepends when replaying a resumed session via /resume.
            let stripped = if raw.starts_with("<local-command-caveat>") {
                if let Some(end) = raw.find("</local-command-caveat>") {
                    raw[end + "</local-command-caveat>".len()..].trim().to_string()
                } else {
                    raw
                }
            } else {
                raw
            };

            // Truncate to 120 Unicode scalar values.
            let summary: String = stripped.chars().take(120).collect();
            let summary = if stripped.chars().count() > 120 {
                format!("{summary}…")
            } else {
                summary
            };

            sessions.push(ClaudeSessionSummary {
                session_id,
                timestamp,
                cwd: session_cwd,
                git_branch,
                summary,
            });
            break; // one opener per file
        }
    }

    // Newest first
    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    sessions
}

// ---------------------------------------------------------------------------
// Claude Code skills browser
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct SkillInfo {
    /// Skill name from frontmatter (falls back to directory name).
    pub name: String,
    /// Description from frontmatter.
    pub description: String,
    /// Version string from frontmatter, if present.
    pub version: Option<String>,
    /// Absolute path to the SKILL.md or .md file.
    pub path: String,
    /// Human-readable source label (plugin name or project path).
    pub source: String,
    /// "skill" for SKILL.md directory skills, "command" for legacy flat .md files.
    pub kind: String,
    /// All files inside the skill directory (absolute paths), sorted.
    /// Empty for flat command files.
    pub files: Vec<String>,
}

/// Recursively collect all file paths under `dir`, sorted.
fn walk_skill_dir(dir: &std::path::Path) -> Vec<String> {
    let mut out = Vec::new();
    fn recurse(dir: &std::path::Path, out: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        let mut children: Vec<std::path::PathBuf> =
            entries.flatten().map(|e| e.path()).collect();
        children.sort();
        for path in children {
            if path.is_dir() {
                recurse(&path, out);
            } else {
                out.push(path.to_string_lossy().into_owned());
            }
        }
    }
    recurse(dir, &mut out);
    out
}

/// Parse `key: value` YAML frontmatter between `---` delimiters.
fn parse_frontmatter(content: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let Some(after_open) = content.strip_prefix("---") else {
        return map;
    };
    // Find closing ---
    let close = after_open.find("\n---").unwrap_or(0);
    for line in after_open[..close].lines() {
        if let Some(colon) = line.find(':') {
            let key = line[..colon].trim().to_string();
            // Strip surrounding quotes from value
            let raw = line[colon + 1..].trim();
            let val = raw.trim_matches('"').trim_matches('\'').to_string();
            if !key.is_empty() {
                map.insert(key, val);
            }
        }
    }
    map
}

fn skill_from_path(skill_md: &std::path::Path, source: &str, kind: &str) -> Option<SkillInfo> {
    let content = std::fs::read_to_string(skill_md).ok()?;
    let fm = parse_frontmatter(&content);
    let is_skill_md = skill_md.file_name().map(|n| n == "SKILL.md").unwrap_or(false);
    let fallback_name = if is_skill_md {
        skill_md
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default()
    } else {
        skill_md
            .file_stem()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default()
    };
    // For directory-based skills, collect all supporting files from the directory.
    // Flat commands: single entry file (same folder may host other commands as separate skills).
    let files = if is_skill_md {
        skill_md.parent().map(walk_skill_dir).unwrap_or_default()
    } else {
        vec![skill_md.to_string_lossy().into_owned()]
    };
    Some(SkillInfo {
        name: fm.get("name").cloned().unwrap_or(fallback_name),
        description: fm.get("description").cloned().unwrap_or_default(),
        version: fm.get("version").cloned().filter(|v| !v.is_empty()),
        path: skill_md.to_string_lossy().into_owned(),
        source: source.to_string(),
        kind: kind.to_string(),
        files,
    })
}

/// Scan a `skills/` directory for `<name>/SKILL.md` entries.
fn collect_skills_dir(dir: &std::path::Path, source: &str, out: &mut Vec<SkillInfo>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let skill_dir = entry.path();
        if !skill_dir.is_dir() {
            continue;
        }
        let skill_md = skill_dir.join("SKILL.md");
        if skill_md.is_file() {
            if let Some(info) = skill_from_path(&skill_md, source, "skill") {
                out.push(info);
            }
        }
    }
}

/// Scan a `commands/` directory for flat `<name>.md` files (legacy format).
fn collect_commands_dir(dir: &std::path::Path, source: &str, out: &mut Vec<SkillInfo>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        if let Some(info) = skill_from_path(&path, source, "command") {
            out.push(info);
        }
    }
}

/// Returns all global/personal skills from three sources:
///  1. `~/.claude/skills/<name>/SKILL.md`   — personal skills
///  2. `~/.claude/commands/<name>.md`        — personal legacy commands
///  3. Installed plugins via `installed_plugins.json` → `installPath/skills/`
#[tauri::command]
pub async fn list_global_skills() -> Vec<SkillInfo> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return vec![],
    };

    let claude_dir = std::path::PathBuf::from(&home).join(".claude");
    let mut skills = Vec::new();

    // 1. Personal skills: ~/.claude/skills/<name>/SKILL.md
    collect_skills_dir(&claude_dir.join("skills"), "personal", &mut skills);

    // 2. Personal legacy commands: ~/.claude/commands/<name>.md
    collect_commands_dir(&claude_dir.join("commands"), "personal (command)", &mut skills);

    // 3. Installed plugins
    let manifest = claude_dir.join("plugins").join("installed_plugins.json");
    if let Ok(content) = std::fs::read_to_string(&manifest) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(plugins) = json.get("plugins").and_then(|v| v.as_object()) {
                for (plugin_key, installs) in plugins {
                    let source = plugin_key.split('@').next().unwrap_or(plugin_key).to_string();
                    let Some(arr) = installs.as_array() else { continue };
                    for install in arr {
                        let Some(install_path) =
                            install.get("installPath").and_then(|v| v.as_str())
                        else {
                            continue;
                        };
                        let plugin_dir = std::path::PathBuf::from(install_path);
                        collect_skills_dir(&plugin_dir.join("skills"), &source, &mut skills);
                        collect_commands_dir(&plugin_dir.join("commands"), &source, &mut skills);
                    }
                }
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// A Claude Code project known to `~/.claude/projects/`.
#[derive(serde::Serialize)]
pub struct ClaudeProject {
    /// The encoded directory key (e.g. `-Users-kannan-Projects-Slate`).
    pub key: String,
    /// The decoded absolute path (e.g. `/Users/kannan/Projects/Slate`).
    pub path: String,
    /// Last path component for display (e.g. `Slate`).
    pub display_name: String,
    /// Whether the decoded path actually exists on disk.
    pub exists: bool,
}

/// Lists all projects known to Claude Code (`~/.claude/projects/`).
#[tauri::command]
pub async fn list_claude_projects() -> Vec<ClaudeProject> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return vec![],
    };

    let projects_dir = std::path::PathBuf::from(&home).join(".claude").join("projects");
    let Ok(entries) = std::fs::read_dir(&projects_dir) else {
        return vec![];
    };

    let mut projects: Vec<ClaudeProject> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if !e.path().is_dir() {
                return None;
            }
            // Decode: replace '-' with '/' (the leading '-' becomes a leading '/')
            let path = name.replace('-', "/");
            let display_name = std::path::Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone());
            let exists = std::path::Path::new(&path).is_dir();
            Some(ClaudeProject { key: name, path, display_name, exists })
        })
        .collect();

    projects.sort_by(|a, b| a.path.cmp(&b.path));
    projects
}

/// Returns project-level skills from `.claude/skills/` and legacy `.claude/commands/`.
#[tauri::command]
pub async fn list_project_skills(project_path: String) -> Vec<SkillInfo> {
    let root = std::path::PathBuf::from(&project_path);
    let claude_dir = root.join(".claude");

    let display = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| project_path.clone());

    let mut skills = Vec::new();
    collect_skills_dir(&claude_dir.join("skills"), &display, &mut skills);
    collect_commands_dir(&claude_dir.join("commands"), &display, &mut skills);

    // Nested monorepo skills: e.g. <project>/src/.claude/skills/
    let src_label = format!("{display} (src)");
    collect_skills_dir(
        &root.join("src").join(".claude").join("skills"),
        &src_label,
        &mut skills,
    );
    collect_commands_dir(
        &root.join("src").join(".claude").join("commands"),
        &src_label,
        &mut skills,
    );

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// Reads and returns the raw file content (full text including frontmatter).
#[tauri::command]
pub async fn read_skill_content(path: String) -> Option<String> {
    std::fs::read_to_string(&path).ok()
}

// ---------------------------------------------------------------------------
// Hooks — read from Claude settings.json files
// ---------------------------------------------------------------------------

/// A single resolved hook handler, with the event and matcher it belongs to.
#[derive(serde::Serialize, Clone)]
pub struct HookInfo {
    pub event: String,
    /// Regex matcher string; empty string means "match all".
    pub matcher: String,
    /// "command" | "http" | "prompt" | "agent"
    pub handler_type: String,
    pub command: Option<String>,
    pub url: Option<String>,
    pub timeout: Option<u64>,
    pub run_in_background: bool,
    pub disabled: bool,
    /// Human-readable path label, e.g. "~/.claude/settings.json"
    pub source: String,
}

fn parse_hooks_from_settings(content: &str, source: &str) -> Vec<HookInfo> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(content) else {
        return vec![];
    };
    let Some(hooks_obj) = v.get("hooks").and_then(|h| h.as_object()) else {
        return vec![];
    };
    let mut result = Vec::new();
    for (event, groups) in hooks_obj {
        let Some(groups) = groups.as_array() else {
            continue;
        };
        for group in groups {
            let matcher = group
                .get("matcher")
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_string();
            let Some(handlers) = group.get("hooks").and_then(|h| h.as_array()) else {
                continue;
            };
            for handler in handlers {
                let handler_type = handler
                    .get("type")
                    .and_then(|t| t.as_str())
                    .unwrap_or("command")
                    .to_string();
                let command = handler
                    .get("command")
                    .and_then(|c| c.as_str())
                    .map(String::from);
                let url = handler
                    .get("url")
                    .and_then(|u| u.as_str())
                    .map(String::from);
                let timeout = handler.get("timeout").and_then(|t| t.as_u64());
                let run_in_background = handler
                    .get("run_in_background")
                    .and_then(|b| b.as_bool())
                    .unwrap_or(false);
                let disabled = handler
                    .get("disabled")
                    .and_then(|d| d.as_bool())
                    .unwrap_or(false);
                result.push(HookInfo {
                    event: event.clone(),
                    matcher: matcher.clone(),
                    handler_type,
                    command,
                    url,
                    timeout,
                    run_in_background,
                    disabled,
                    source: source.to_string(),
                });
            }
        }
    }
    result
}

#[tauri::command]
pub async fn list_global_hooks() -> Vec<HookInfo> {
    let home = std::env::var("HOME").unwrap_or_default();
    if home.is_empty() {
        return vec![];
    }
    let base = std::path::Path::new(&home).join(".claude");
    let mut result = Vec::new();
    let paths = [
        (base.join("settings.json"), "~/.claude/settings.json"),
        (base.join("settings.local.json"), "~/.claude/settings.local.json"),
    ];
    for (path, label) in paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            result.extend(parse_hooks_from_settings(&content, label));
        }
    }
    result
}

fn collect_project_settings_hook_paths(root: &std::path::Path) -> Vec<(std::path::PathBuf, &'static str)> {
    vec![
        (
            root.join(".claude/settings.json"),
            ".claude/settings.json",
        ),
        (
            root.join(".claude/settings.local.json"),
            ".claude/settings.local.json",
        ),
        (
            root.join("src").join(".claude").join("settings.json"),
            "src/.claude/settings.json",
        ),
        (
            root.join("src").join(".claude").join("settings.local.json"),
            "src/.claude/settings.local.json",
        ),
    ]
}

#[tauri::command]
pub async fn list_project_hooks(project_path: String) -> Vec<HookInfo> {
    let root = std::path::PathBuf::from(&project_path);
    let mut result = Vec::new();
    for (p, label) in collect_project_settings_hook_paths(&root) {
        if let Ok(content) = std::fs::read_to_string(&p) {
            result.extend(parse_hooks_from_settings(&content, label));
        }
    }
    result
}

