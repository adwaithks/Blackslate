//! Unit tests for [`super::resolve_path`] (tilde expansion against `HOME`).

use super::resolve_path;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// `set_var` / `remove_var` are process-global; serialize HOME mutations across tests.
fn home_lock() -> std::sync::MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
}

/// Temporarily sets or clears `HOME`, runs `f`, then restores the previous value.
fn with_home<T>(value: Option<&str>, f: impl FnOnce() -> T) -> T {
    let _g = home_lock();
    let prev = std::env::var("HOME").ok();
    match value {
        Some(v) => std::env::set_var("HOME", v),
        None => std::env::remove_var("HOME"),
    }
    let out = f();
    match prev {
        Some(v) => std::env::set_var("HOME", v),
        None => std::env::remove_var("HOME"),
    }
    out
}

/// **What:** `~/…` with a path segment after `~` becomes `$HOME/…`.
///
/// **Why:** This is the main contract for session cwd strings from the UI (`~/Projects/...`).
/// Regressions here break `git_info` and anything else that resolves a user-typed home-relative path.
#[test]
fn expands_tilde_child_when_home_set() {
    with_home(Some("/tmp/blackslate-home"), || {
        assert_eq!(
            resolve_path("~/Projects/app"),
            PathBuf::from("/tmp/blackslate-home/Projects/app")
        );
    });
}

/// **What:** A path that is only `~` expands to the home directory.
///
/// **Why:** `strip_prefix("~")` yields an empty remainder; `PathBuf::join("")` still appends a
/// trailing separator. We lock that behaviour so a change in `join` or our logic does not surprise
/// callers that compare against `PathBuf::from($HOME)` without a trailing `/`.
#[test]
fn expands_bare_tilde_when_home_set() {
    with_home(Some("/tmp/blackslate-home"), || {
        assert_eq!(resolve_path("~"), PathBuf::from("/tmp/blackslate-home/"));
    });
}

/// **What:** If `HOME` is not set, `~/foo` is left as the literal path `~/foo`.
///
/// **Why:** Some environments lack `HOME`; we must not invent a default or panic. The path stays
/// invalid for real FS ops until the user fixes env — better than silently wrong resolution.
#[test]
fn does_not_expand_when_home_unset() {
    with_home(None, || {
        assert_eq!(resolve_path("~/foo"), PathBuf::from("~/foo"));
    });
}

/// **What:** If `HOME` is the empty string, `~/foo` is not expanded.
///
/// **Why:** Without this guard, `PathBuf::from("").join("foo")` becomes just `foo`, a relative path —
/// a subtle bug that looks like expansion but drops `~` and the intended root. Empty `HOME` is
/// treated like “no usable home”.
#[test]
fn does_not_expand_when_home_empty() {
    with_home(Some(""), || {
        assert_eq!(resolve_path("~/foo"), PathBuf::from("~/foo"));
    });
}

/// **What:** Absolute POSIX paths are returned unchanged, regardless of `HOME`.
///
/// **Why:** Prevents regressions where we prefix or rewrite paths that already start at `/`.
/// Git and subprocess helpers must receive true absolute paths untouched.
#[test]
fn absolute_path_unchanged_even_if_home_wrong() {
    with_home(Some("/wrong"), || {
        assert_eq!(
            resolve_path("/usr/local/bin"),
            PathBuf::from("/usr/local/bin")
        );
    });
}

/// **What:** `~` only expands when it is the **first** path component (`~/...`), not when it
/// appears later (`foo/~/bar`).
///
/// **Why:** Expansion is component-based (`Path::starts_with("~")`), not string substitution.
/// A naive “replace all `~`” would corrupt real directory names or odd relative paths.
#[test]
fn tilde_not_first_component_is_unchanged() {
    with_home(Some("/tmp/blackslate-home"), || {
        assert_eq!(resolve_path("foo/~/bar"), PathBuf::from("foo/~/bar"));
    });
}

/// **What:** `~~/foo` does not expand (first component is `~~`, not `~`).
///
/// **Why:** Locks the difference between path-prefix rules and shell-specific `~~` semantics.
/// String-based checks like `starts_with('~')` on `&str` could mis-handle this; we rely on `Path`.
#[test]
fn double_tilde_prefix_is_unchanged() {
    with_home(Some("/tmp/blackslate-home"), || {
        assert_eq!(resolve_path("~~/foo"), PathBuf::from("~~/foo"));
    });
}
