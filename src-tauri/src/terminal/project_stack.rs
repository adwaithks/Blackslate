//! Detects common project stacks from files at the nearest project root (walked upward from cwd).
//!
//! To add a new stack: implement a `fn detect_xxx(root: &Path) -> Option<ProjectStackItem>` and
//! append it to `DETECTOR_ORDER` + `run_detector`.

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

/// One badge row in the sidebar (e.g. Rust 1.75, React 19).
#[derive(Debug, Clone, Serialize)]
pub struct ProjectStackItem {
    pub id: String,
    pub label: String,
    pub version: Option<String>,
}

/// Tauri command entry: resolve cwd, find project root, run all detectors.
pub fn detect(cwd: String) -> Vec<ProjectStackItem> {
    let path = super::resolve_path(&cwd);
    let Some(root) = find_project_root(&path) else {
        return Vec::new();
    };
    run_all_detectors(&root)
}

fn find_project_root(start: &Path) -> Option<PathBuf> {
    let mut p = start.to_path_buf();
    loop {
        if has_project_marker(&p) {
            return Some(p);
        }
        if !p.pop() {
            break;
        }
    }
    None
}

fn has_project_marker(dir: &Path) -> bool {
    [
        "package.json",
        "Cargo.toml",
        "go.mod",
        "pyproject.toml",
        "setup.py",
        "requirements.txt",
        ".python-version",
    ]
    .iter()
    .any(|f| dir.join(f).is_file())
}

fn run_all_detectors(root: &Path) -> Vec<ProjectStackItem> {
    let mut items: Vec<ProjectStackItem> = Vec::new();

    // Extensible: add `(id, closure)` pairs. Order here is display order.
    let detectors: &[fn(&Path) -> Option<ProjectStackItem>] = &[
        detect_rust,
        detect_go,
        detect_node,
        detect_react,
        detect_python,
    ];

    for d in detectors {
        if let Some(item) = d(root) {
            if !items.iter().any(|x| x.id == item.id) {
                items.push(item);
            }
        }
    }

    items
}

// --- Rust -------------------------------------------------------------------

fn detect_rust(root: &Path) -> Option<ProjectStackItem> {
    let p = root.join("Cargo.toml");
    if !p.is_file() {
        return None;
    }
    let s = fs::read_to_string(&p).ok()?;
    let value: toml::Value = toml::from_str(&s).ok()?;
    let pkg = value.get("package")?;
    let crate_ver = pkg.get("version").and_then(|v| v.as_str()).map(String::from);
    let msrv = pkg
        .get("rust-version")
        .and_then(|v| v.as_str())
        .map(String::from);
    let version = match (&crate_ver, &msrv) {
        (Some(cv), Some(m)) if cv != m => Some(format!("{cv} · {m}")),
        (Some(cv), _) => Some(cv.clone()),
        (None, Some(m)) => Some(m.clone()),
        (None, None) => None,
    };

    Some(ProjectStackItem {
        id: "rust".into(),
        label: "Rust".into(),
        version,
    })
}

// --- Go ---------------------------------------------------------------------

fn detect_go(root: &Path) -> Option<ProjectStackItem> {
    let p = root.join("go.mod");
    if !p.is_file() {
        return None;
    }
    let s = fs::read_to_string(&p).ok()?;
    let mut go_ver: Option<String> = None;
    for line in s.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("go ") {
            let v = rest.split_whitespace().next().unwrap_or(rest);
            go_ver = Some(v.to_string());
            break;
        }
    }
    Some(ProjectStackItem {
        id: "go".into(),
        label: "Go".into(),
        version: go_ver,
    })
}

// --- Node + React (package.json) -------------------------------------------

fn detect_node(root: &Path) -> Option<ProjectStackItem> {
    let v = read_package_json(root)?;
    let ver = v
        .get("engines")
        .and_then(|e| e.get("node"))
        .and_then(|x| x.as_str())
        .map(trim_ver);
    Some(ProjectStackItem {
        id: "node".into(),
        label: "Node".into(),
        version: ver,
    })
}

fn detect_react(root: &Path) -> Option<ProjectStackItem> {
    let v = read_package_json(root)?;
    let ver = v
        .get("dependencies")
        .and_then(|d| d.get("react"))
        .or_else(|| v.get("devDependencies").and_then(|d| d.get("react")))
        .and_then(|x| x.as_str())?;
    Some(ProjectStackItem {
        id: "react".into(),
        label: "React".into(),
        version: Some(trim_ver(ver)),
    })
}

fn read_package_json(root: &Path) -> Option<Value> {
    let p = root.join("package.json");
    if !p.is_file() {
        return None;
    }
    let s = fs::read_to_string(&p).ok()?;
    serde_json::from_str(&s).ok()
}

// --- Python -----------------------------------------------------------------

fn detect_python(root: &Path) -> Option<ProjectStackItem> {
    let pyproject = root.join("pyproject.toml");
    if pyproject.is_file() {
        let ver = parse_pyproject_python_version(&pyproject);
        return Some(ProjectStackItem {
            id: "python".into(),
            label: "Python".into(),
            version: ver,
        });
    }
    if let Some(v) = python_from_dot_version(&root.join(".python-version")) {
        return Some(v);
    }
    if root.join("setup.py").is_file() || root.join("requirements.txt").is_file() {
        return Some(ProjectStackItem {
            id: "python".into(),
            label: "Python".into(),
            version: None,
        });
    }
    None
}

fn parse_pyproject_python_version(path: &Path) -> Option<String> {
    let s = fs::read_to_string(path).ok()?;
    let value: toml::Value = toml::from_str(&s).ok()?;
    let req = value
        .get("project")
        .and_then(|p| p.get("requires-python"))
        .and_then(|v| v.as_str())
        .map(trim_ver)
        .or_else(|| {
            value
                .get("tool")
                .and_then(|t| t.get("poetry"))
                .and_then(|p| p.get("dependencies"))
                .and_then(|d| d.get("python"))
                .and_then(|v| v.as_str())
                .map(trim_ver)
        });
    req
}

fn python_from_dot_version(path: &Path) -> Option<ProjectStackItem> {
    if !path.is_file() {
        return None;
    }
    let s = fs::read_to_string(path).ok()?;
    let line = s.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }
    Some(ProjectStackItem {
        id: "python".into(),
        label: "Python".into(),
        version: Some(trim_ver(line)),
    })
}

fn trim_ver(s: &str) -> String {
    s.trim()
        .trim_start_matches(|c: char| matches!(c, '^' | '~' | '>' | '=' | '<'))
        .split(',')
        .next()
        .unwrap_or(s)
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trim_ver_strips_caret() {
        assert_eq!(trim_ver("^19.0.0"), "19.0.0");
        assert_eq!(trim_ver(">=3.10,<4"), "3.10");
    }
}
