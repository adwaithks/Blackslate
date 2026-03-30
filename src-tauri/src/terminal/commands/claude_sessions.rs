use crate::terminal::resolve_path;

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

    let resolved = resolve_path(&cwd);
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

        for line in content.lines() {
            let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) else {
                continue;
            };

            if obj.get("type").and_then(|v| v.as_str()) != Some("user") {
                continue;
            }
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

            let stripped = if raw.starts_with("<local-command-caveat>") {
                if let Some(end) = raw.find("</local-command-caveat>") {
                    raw[end + "</local-command-caveat>".len()..].trim().to_string()
                } else {
                    raw
                }
            } else {
                raw
            };

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
            break;
        }
    }

    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    sessions
}
