//! Unit tests for `parse_hooks_from_settings` and `collect_project_settings_hook_paths`.
//!
//! Both functions are pure (string/path in → structs/paths out) so every test runs
//! without touching the filesystem, making them fast and deterministic.

use std::path::PathBuf;

// ─── parse_hooks_from_settings ────────────────────────────────────────────────

/// **What:** Passes completely invalid JSON.
/// **Why:** Guards against panics or unwrap failures when a settings file is truncated,
/// empty, or corrupted on disk. Must return an empty vec, never crash.
#[test]
fn bad_json_returns_empty() {
    let hooks = super::parse_hooks_from_settings("not json at all {{{", "test");
    assert!(hooks.is_empty());
}

/// **What:** Passes valid JSON that has no top-level `hooks` key.
/// **Why:** Claude Code settings files have many keys; if `hooks` is absent (e.g. a fresh
/// global config) the parser must return empty and not panic on a missing field.
#[test]
fn missing_hooks_key_returns_empty() {
    let json = r#"{ "model": "sonnet", "theme": "dark" }"#;
    let hooks = super::parse_hooks_from_settings(json, "test");
    assert!(hooks.is_empty());
}

/// **What:** Passes JSON where `hooks` exists but is an array instead of an object.
/// **Why:** If the upstream schema ever changes shape (or we get handed the wrong file),
/// we should degrade gracefully rather than index-out-of-bounds or unwrap.
#[test]
fn hooks_key_not_object_returns_empty() {
    let json = r#"{ "hooks": [] }"#;
    let hooks = super::parse_hooks_from_settings(json, "test");
    assert!(hooks.is_empty());
}

/// **What:** Parses a minimal valid hook that omits every optional field.
/// **Why:** Verifies the defaults that the UI relies on: `matcher` = empty string (match-all),
/// `handler_type` = `"command"`, `run_in_background` = false, `disabled` = false.
/// Regressions here silently change UI behaviour (e.g. a hook that should run in
/// foreground starts running in background).
#[test]
fn defaults_applied_when_optional_fields_absent() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                {
                    "hooks": [
                        { "command": "cargo fmt" }
                    ]
                }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 1);
    let h = &hooks[0];
    assert_eq!(h.matcher, "");
    assert_eq!(h.handler_type, "command");
    assert!(!h.run_in_background);
    assert!(!h.disabled);
    assert_eq!(h.command.as_deref(), Some("cargo fmt"));
    assert!(h.url.is_none());
    assert!(h.timeout.is_none());
}

/// **What:** Parses a hook where every optional field is explicitly set to a non-default value.
/// **Why:** Confirms that explicit values win over defaults; catches an off-by-one or wrong
/// field extraction if a future refactor shuffles the field order.
#[test]
fn explicit_values_override_all_defaults() {
    let json = r#"{
        "hooks": {
            "PostToolUse": [
                {
                    "matcher": "\\.rs$",
                    "hooks": [
                        {
                            "type": "http",
                            "url": "http://localhost:9000/hook",
                            "timeout": 30,
                            "run_in_background": true,
                            "disabled": true
                        }
                    ]
                }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 1);
    let h = &hooks[0];
    assert_eq!(h.matcher, "\\.rs$");
    assert_eq!(h.handler_type, "http");
    assert_eq!(h.url.as_deref(), Some("http://localhost:9000/hook"));
    assert_eq!(h.timeout, Some(30));
    assert!(h.run_in_background);
    assert!(h.disabled);
    assert!(h.command.is_none());
}

/// **What:** Parses two different top-level events and asserts both appear in the flat output.
/// **Why:** The function must iterate all events, not just the first. A `break` or early
/// return bug would silently drop hooks for every event after the first.
#[test]
fn multiple_events_expand_to_flat_list() {
    let json = r#"{
        "hooks": {
            "PreToolUse":  [{ "hooks": [{ "command": "pre"  }] }],
            "PostToolUse": [{ "hooks": [{ "command": "post" }] }]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 2);

    let events: std::collections::HashSet<&str> = hooks.iter().map(|h| h.event.as_str()).collect();
    assert!(events.contains("PreToolUse"));
    assert!(events.contains("PostToolUse"));
}

/// **What:** Parses one event with two groups; each group has its own matcher.
/// **Why:** Groups are the mechanism for per-file-pattern hooks. A bug that only processes
/// the first group would hide all hooks from the second pattern — very hard to notice.
#[test]
fn multiple_groups_under_one_event_all_parsed() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                { "matcher": "\\.rs$", "hooks": [{ "command": "rustfmt" }] },
                { "matcher": "\\.ts$", "hooks": [{ "command": "prettier" }] }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 2);
    assert_eq!(hooks[0].matcher, "\\.rs$");
    assert_eq!(hooks[1].matcher, "\\.ts$");
}

/// **What:** Parses one group that contains two handlers; both must appear in the output.
/// **Why:** Users can chain multiple commands on a single event+matcher. The inner handler
/// loop must iterate all entries, not just `hooks[0]`.
#[test]
fn multiple_handlers_in_one_group_all_parsed() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                {
                    "matcher": "",
                    "hooks": [
                        { "command": "echo first"  },
                        { "command": "echo second" }
                    ]
                }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 2);
    assert_eq!(hooks[0].command.as_deref(), Some("echo first"));
    assert_eq!(hooks[1].command.as_deref(), Some("echo second"));
}

/// **What:** Checks that both handlers in a group inherit the group's `matcher`.
/// **Why:** `matcher` lives at the group level, not the handler level. Every handler in a
/// group shares it; a copy/paste error that reads it from the handler instead would
/// silently produce empty matchers for multi-handler groups.
#[test]
fn matcher_is_shared_across_all_handlers_in_group() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                {
                    "matcher": "\\.rs$",
                    "hooks": [
                        { "command": "rustfmt" },
                        { "command": "clippy"  }
                    ]
                }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 2);
    assert_eq!(hooks[0].matcher, "\\.rs$");
    assert_eq!(hooks[1].matcher, "\\.rs$");
}

/// **What:** Checks that a group with no `hooks` array is silently skipped.
/// **Why:** Claude Code settings may have groups without a handlers list (e.g. a
/// template/placeholder). The parser must skip them rather than panic on `unwrap`.
#[test]
fn group_without_hooks_array_is_skipped() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                { "matcher": "no-handlers-here" },
                { "matcher": "", "hooks": [{ "command": "ok" }] }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks.len(), 1);
    assert_eq!(hooks[0].command.as_deref(), Some("ok"));
}

/// **What:** Verifies the `source` label is propagated to every `HookInfo` entry.
/// **Why:** The UI shows which settings file a hook came from. If `source` is not cloned
/// into every item the sidebar label would be blank or wrong for all but the first hook.
#[test]
fn source_label_propagated_to_every_hook_info() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [
                { "hooks": [{ "command": "a" }, { "command": "b" }] }
            ]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "~/.claude/settings.json");
    assert_eq!(hooks.len(), 2);
    assert!(hooks.iter().all(|h| h.source == "~/.claude/settings.json"));
}

/// **What:** Parses a hook with `timeout` set to a numeric value.
/// **Why:** `timeout` is read as `u64` via `as_u64()`; a float or negative value would
/// silently become `None`. This test locks the happy path so we notice if the type
/// mapping changes.
#[test]
fn timeout_u64_is_preserved() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [{ "hooks": [{ "command": "x", "timeout": 60 }] }]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert_eq!(hooks[0].timeout, Some(60));
}

/// **What:** Parses a hook that has no `timeout` field.
/// **Why:** `timeout` is optional; the UI uses `None` to mean "no timeout set".
/// Ensures we get `None`, not a default of 0.
#[test]
fn timeout_absent_yields_none() {
    let json = r#"{
        "hooks": {
            "PreToolUse": [{ "hooks": [{ "command": "x" }] }]
        }
    }"#;
    let hooks = super::parse_hooks_from_settings(json, "src");
    assert!(hooks[0].timeout.is_none());
}

// ─── collect_project_settings_hook_paths ──────────────────────────────────────

/// **What:** Asserts the function returns exactly four paths.
/// **Why:** The count is load-bearing: the caller iterates the vec to read settings files.
/// Any accidental addition or removal of a path would break that iteration silently.
#[test]
fn returns_exactly_four_paths() {
    let root = PathBuf::from("/my/project");
    let paths = super::collect_project_settings_hook_paths(&root);
    assert_eq!(paths.len(), 4);
}

/// **What:** Verifies the first two paths live directly under `.claude/` in the root.
/// **Why:** These are the primary per-repo hook locations. If the relative join is wrong
/// (e.g. `root.join("claude/settings.json")` vs `root.join(".claude/settings.json")`),
/// the files are never read and all project hooks silently disappear.
#[test]
fn first_two_paths_are_under_dotclaude_in_root() {
    let root = PathBuf::from("/proj");
    let paths = super::collect_project_settings_hook_paths(&root);
    assert_eq!(paths[0].0, PathBuf::from("/proj/.claude/settings.json"));
    assert_eq!(paths[1].0, PathBuf::from("/proj/.claude/settings.local.json"));
}

/// **What:** Verifies the last two paths live under `src/.claude/` in the root.
/// **Why:** Mono-repos often keep Claude settings inside a `src/` sub-tree.
/// A wrong path prefix (`src-tauri` vs `src`) would silently skip all those hooks.
#[test]
fn last_two_paths_are_under_src_dotclaude_in_root() {
    let root = PathBuf::from("/proj");
    let paths = super::collect_project_settings_hook_paths(&root);
    assert_eq!(paths[2].0, PathBuf::from("/proj/src/.claude/settings.json"));
    assert_eq!(paths[3].0, PathBuf::from("/proj/src/.claude/settings.local.json"));
}

/// **What:** Checks that all four label strings are correct and in the right order.
/// **Why:** Labels are displayed in the settings UI next to each hook; a transposed or
/// truncated label makes it impossible to tell which file a hook came from.
#[test]
fn all_four_labels_are_correct() {
    let root = PathBuf::from("/any");
    let paths = super::collect_project_settings_hook_paths(&root);
    let labels: Vec<&str> = paths.iter().map(|(_, l)| *l).collect();
    assert_eq!(labels, vec![
        ".claude/settings.json",
        ".claude/settings.local.json",
        "src/.claude/settings.json",
        "src/.claude/settings.local.json",
    ]);
}

/// **What:** Calls the function with a different root and asserts the paths change accordingly.
/// **Why:** Confirms the function is not hard-coding absolute paths; the root argument
/// is the only variable and must be honoured on every returned path.
#[test]
fn paths_are_rooted_at_the_provided_root() {
    let root_a = PathBuf::from("/workspace/alpha");
    let root_b = PathBuf::from("/workspace/beta");
    let a = super::collect_project_settings_hook_paths(&root_a);
    let b = super::collect_project_settings_hook_paths(&root_b);
    for ((pa, _), (pb, _)) in a.iter().zip(b.iter()) {
        assert_ne!(pa, pb, "same path returned for different roots");
        assert!(pa.starts_with(&root_a));
        assert!(pb.starts_with(&root_b));
    }
}
