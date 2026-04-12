# Security Policy

## Supported Versions

Blackslate is currently in **Alpha**. Only the latest release receives security fixes.

| Version | Supported |
|---------|-----------|
| 0.1.x (alpha) | ✓ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities via [GitHub Security Advisories](https://github.com/adwaithks/Blackslate/security/advisories/new) — click **"Report a vulnerability"** on the Security tab of this repository.

Include as much of the following as you can:

- Type of issue (e.g. command injection, path traversal, arbitrary code execution)
- File paths and line numbers relevant to the issue
- Steps to reproduce
- Proof-of-concept or exploit code (if available)
- Impact assessment — what an attacker could achieve

You should receive a response within **72 hours**. If you do not, follow up by opening a non-sensitive GitHub issue referencing that you submitted a security report.

## Scope

Blackslate is a macOS desktop app that wraps a PTY shell. The relevant attack surface for this alpha:

- **PTY command injection** — input passed to the shell
- **Git operations** — path handling in `git_diff`, `git_status`, and related commands
- **File system access** — `pick_folders`, `list_md_files`, wiki file picker
- **Tauri IPC** — command handler input validation

**Alpha expectations:** early builds may ship with a permissive webview configuration (for example `csp: null` and devtools enabled in `tauri.conf.json`). Reports that only restate those settings are lower priority unless you show exploitable impact beyond “defaults are relaxed.”
