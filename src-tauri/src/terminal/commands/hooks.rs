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
