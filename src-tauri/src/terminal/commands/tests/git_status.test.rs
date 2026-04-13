//! Unit tests for git status **parsing**, **poll hashing**, and **worktree list parsing**.

use super::{GitFile, GitStatusResult, parse_worktree_list};

/// **What:** Parses `git diff --name-status` lines for modified (`M`) and added (`A`) files.
/// **Why:** Core mapping from git’s first column to our `GitFile.status` strings; regressions break the git panel labels.
#[test]
fn parse_name_status_modified_and_added() {
    let out = "M\tsrc/foo.rs\nA\tnew.txt\n";
    let m = super::parse_name_status(out);
    assert_eq!(m.get("src/foo.rs").map(String::as_str), Some("modified"));
    assert_eq!(m.get("new.txt").map(String::as_str), Some("added"));
}

/// **What:** Parses a deleted file line (`D\tpath`).
/// **Why:** Deleted entries must map to `"deleted"` so the UI can style them differently from modified.
#[test]
fn parse_name_status_deleted() {
    let out = "D\tgone.md\n";
    let m = super::parse_name_status(out);
    assert_eq!(m.get("gone.md").map(String::as_str), Some("deleted"));
}

/// **What:** Parses a rename line (`R100\told\tnew`) and keeps only the **new** path as the key.
/// **Why:** Git reports two paths for renames; the sidebar and status list should show the current path, not the old one.
#[test]
fn parse_name_status_rename_uses_new_path() {
    let out = "R100\told/name.txt\tnew/name.txt\n";
    let m = super::parse_name_status(out);
    assert_eq!(m.get("new/name.txt").map(String::as_str), Some("renamed"));
    assert!(m.get("old/name.txt").is_none());
}

/// **What:** Mixes a valid line with a malformed line (too few tab fields).
/// **Why:** Partial or noisy git output must not panic; we skip bad lines and still parse the rest.
#[test]
fn parse_name_status_ignores_bad_lines() {
    let out = "M\tok.rs\nnot enough fields\n";
    let m = super::parse_name_status(out);
    assert_eq!(m.len(), 1);
    assert_eq!(m.get("ok.rs").map(String::as_str), Some("modified"));
}

/// **What:** Parses `git diff --numstat` lines for normal numeric stats and binary (`-` `-`).
/// **Why:** Binary files use `-` for add/del counts; we normalize to `-1` so the frontend can show “binary” instead of bogus numbers.
#[test]
fn parse_numstat_regular_and_binary() {
    let out = "3\t2\tsrc/a.rs\n-\t-\tbinary.bin\n";
    let m = super::parse_numstat(out);
    assert_eq!(m.get("src/a.rs"), Some(&(3, 2)));
    assert_eq!(m.get("binary.bin"), Some(&(-1, -1)));
}

/// **What:** Supplies a line with only two tab-separated fields (missing path) plus one valid three-field line.
/// **Why:** Ensures we only insert when `splitn(3)` yields exactly path + stats; avoids empty or wrong keys.
#[test]
fn parse_numstat_skips_short_lines() {
    let out = "1\t2\n3\t4\tok/path\n";
    let m = super::parse_numstat(out);
    assert_eq!(m.len(), 1);
    assert_eq!(m.get("ok/path"), Some(&(3, 4)));
}

/// **What:** Builds two identical `GitStatusResult` values and compares `hash_status` output.
/// **Why:** The poll API uses this hash to skip re-renders; identical snapshots must produce the same string every time.
#[test]
fn hash_status_stable_for_same_payload() {
    let a = GitStatusResult {
        branch: "main".into(),
        unstaged: vec![GitFile {
            path: "a.rs".into(),
            additions: 1,
            deletions: 0,
            status: "modified".into(),
        }],
        staged: vec![],
    };
    let b = GitStatusResult {
        branch: "main".into(),
        unstaged: vec![GitFile {
            path: "a.rs".into(),
            additions: 1,
            deletions: 0,
            status: "modified".into(),
        }],
        staged: vec![],
    };
    assert_eq!(super::hash_status(&a), super::hash_status(&b));
}

/// **What:** Hashes two results that differ only in `branch`.
/// **Why:** Branch changes must bump the hash so the client refetches status after checkout; otherwise the UI stays stale.
#[test]
fn hash_status_differs_when_branch_changes() {
    let base = GitStatusResult {
        branch: "main".into(),
        unstaged: vec![],
        staged: vec![],
    };
    let other = GitStatusResult {
        branch: "dev".into(),
        unstaged: vec![],
        staged: vec![],
    };
    assert_ne!(super::hash_status(&base), super::hash_status(&other));
}

// ---------------------------------------------------------------------------
// parse_worktree_list
// ---------------------------------------------------------------------------

/// **What:** Parses `git worktree list --porcelain` output with one normal worktree.
/// **Why:** A repo with no extra worktrees must return exactly one entry marked as main.
#[test]
fn parse_worktree_list_single() {
    let out = "worktree /home/user/my-repo\nHEAD abc1234def56\nbranch refs/heads/main\n\n";
    let wts = parse_worktree_list(out);
    assert_eq!(wts.len(), 1);
    assert_eq!(wts[0].path, "/home/user/my-repo");
    assert_eq!(wts[0].branch, "main");
    assert!(wts[0].is_main);
    assert!(!wts[0].is_detached);
}

/// **What:** Parses output with a main worktree and one linked worktree.
/// **Why:** Core multi-worktree case; the first block must be `is_main=true`, the second `is_main=false`.
#[test]
fn parse_worktree_list_two_worktrees() {
    let out = concat!(
        "worktree /home/user/my-repo\n",
        "HEAD abc1234\n",
        "branch refs/heads/main\n",
        "\n",
        "worktree /home/user/my-repo-wt\n",
        "HEAD def5678\n",
        "branch refs/heads/feature/xyz\n",
        "\n",
    );
    let wts = parse_worktree_list(out);
    assert_eq!(wts.len(), 2);
    assert!(wts[0].is_main);
    assert_eq!(wts[0].branch, "main");
    assert!(!wts[1].is_main);
    assert_eq!(wts[1].branch, "feature/xyz");
    assert_eq!(wts[1].path, "/home/user/my-repo-wt");
}

/// **What:** Parses a detached HEAD worktree.
/// **Why:** The `detached` line replaces `branch`; `is_detached` must be true and the display branch
///          must fall back to a short hash so the UI always has something to show.
#[test]
fn parse_worktree_list_detached_head() {
    let out = concat!(
        "worktree /home/user/my-repo\n",
        "HEAD abc1234def56\n",
        "detached\n",
        "\n",
    );
    let wts = parse_worktree_list(out);
    assert_eq!(wts.len(), 1);
    assert!(wts[0].is_detached);
    // Branch falls back to a short-hash label.
    assert!(wts[0].branch.starts_with('('), "expected hash label, got {}", wts[0].branch);
}

/// **What:** Passes an empty string (no output).
/// **Why:** Edge case when the command fails or the path is not a git repo; must not panic and return empty.
#[test]
fn parse_worktree_list_empty_input() {
    let wts = parse_worktree_list("");
    assert!(wts.is_empty());
}
