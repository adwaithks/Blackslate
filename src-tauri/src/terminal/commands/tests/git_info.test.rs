//! Unit tests for [`super::branch_label_from_git_head`] — how we turn `.git/HEAD` contents into a sidebar-friendly branch label.

/// **What:** Parses a standard symbolic ref line (`ref: refs/heads/main`).
/// **Why:** Most repos on a branch use this format; the label must be the short branch name (`main`), not the full ref.
#[test]
fn branch_label_from_branch_ref() {
    assert_eq!(
        super::branch_label_from_git_head("ref: refs/heads/main\n"),
        Some("main".to_string())
    );
}

/// **What:** Parses the same ref format with leading/trailing whitespace.
/// **Why:** `read_to_string` often includes newlines; we trim so stray spaces do not break prefix matching or leak into the label.
#[test]
fn branch_label_from_branch_ref_trimmed() {
    assert_eq!(
        super::branch_label_from_git_head("  ref: refs/heads/feature/x  "),
        Some("feature/x".to_string())
    );
}

/// **What:** Parses a detached HEAD: a 40-char (or longer) hex object id.
/// **Why:** We show a shortened display form (`(abcdef0…)`) so the UI never dumps a full hash into the title bar.
#[test]
fn branch_label_detached_short_hash() {
    let hash = "abcdef0123456789";
    assert_eq!(
        super::branch_label_from_git_head(hash),
        Some("(abcdef0…)".to_string())
    );
}

/// **What:** Passes a non-ref string shorter than 7 characters (not a displayable abbreviated sha).
/// **Why:** Malformed or tiny `HEAD` files should yield `None` so `git_info` does not show nonsense; matches production guard.
#[test]
fn branch_label_detached_too_short() {
    assert_eq!(super::branch_label_from_git_head("abc"), None);
}

/// **What:** Passes whitespace-only content after trim becomes empty (via `strip_prefix` path: empty trimmed body).
/// **Why:** Empty `HEAD` is invalid; we return `None` instead of `Some("")` or a fake detached label.
#[test]
fn branch_label_empty_after_trim() {
    assert_eq!(super::branch_label_from_git_head("   \n"), None);
}
