//! Unit tests for [`super::git_diff_exited_ok`] — the rule that maps `git diff` exit codes to success/failure.

use std::process::Command;

/// **What:** Feeds a real `ExitStatus` from a process that exits 0 into `git_diff_exited_ok`.
/// **Why:** `git diff` exits 0 when there is no patch; we must accept that or untracked/unchanged cases surface as errors.
#[test]
fn git_diff_exited_ok_accepts_exit_0() {
    let status = Command::new("true").status().expect("true");
    assert!(super::git_diff_exited_ok(&status));
}

/// **What:** Feeds an `ExitStatus` with code 1 into `git_diff_exited_ok`.
/// **Why:** Git uses exit code **1** when a diff exists (non-empty patch). Treating only `success()` as OK would reject valid diffs.
#[test]
fn git_diff_exited_ok_accepts_exit_1() {
    let status = Command::new("sh")
        .args(["-c", "exit 1"])
        .status()
        .expect("sh");
    assert!(super::git_diff_exited_ok(&status));
}

/// **What:** Feeds an `ExitStatus` with code 2 (non-1 failure) into `git_diff_exited_ok`.
/// **Why:** Real git errors (bad args, not a repo, etc.) must still fail so we do not swallow stderr-worthy failures.
#[test]
fn git_diff_exited_ok_rejects_other_codes() {
    let status = Command::new("sh")
        .args(["-c", "exit 2"])
        .status()
        .expect("sh");
    assert!(!super::git_diff_exited_ok(&status));
}
