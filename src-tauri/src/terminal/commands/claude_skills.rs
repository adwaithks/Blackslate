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

fn walk_skill_dir(dir: &std::path::Path) -> Vec<String> {
    let mut out = Vec::new();
    fn recurse(dir: &std::path::Path, out: &mut Vec<String>) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        let mut children: Vec<std::path::PathBuf> = entries.flatten().map(|e| e.path()).collect();
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

fn parse_frontmatter(content: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let Some(after_open) = content.strip_prefix("---") else {
        return map;
    };
    let close = after_open.find("\n---").unwrap_or(0);
    for line in after_open[..close].lines() {
        if let Some(colon) = line.find(':') {
            let key = line[..colon].trim().to_string();
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
    let is_skill_md = skill_md
        .file_name()
        .map(|n| n == "SKILL.md")
        .unwrap_or(false);
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

fn collect_skills_dir(dir: &std::path::Path, source: &str, out: &mut Vec<SkillInfo>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
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

fn collect_commands_dir(dir: &std::path::Path, source: &str, out: &mut Vec<SkillInfo>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
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

    collect_skills_dir(&claude_dir.join("skills"), "personal", &mut skills);

    collect_commands_dir(
        &claude_dir.join("commands"),
        "personal (command)",
        &mut skills,
    );

    let manifest = claude_dir.join("plugins").join("installed_plugins.json");
    if let Ok(content) = std::fs::read_to_string(&manifest) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(plugins) = json.get("plugins").and_then(|v| v.as_object()) {
                for (plugin_key, installs) in plugins {
                    let source = plugin_key
                        .split('@')
                        .next()
                        .unwrap_or(plugin_key)
                        .to_string();
                    let Some(arr) = installs.as_array() else {
                        continue;
                    };
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

    let projects_dir = std::path::PathBuf::from(&home)
        .join(".claude")
        .join("projects");
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
            let path = name.replace('-', "/");
            let display_name = std::path::Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone());
            let exists = std::path::Path::new(&path).is_dir();
            Some(ClaudeProject {
                key: name,
                path,
                display_name,
                exists,
            })
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
