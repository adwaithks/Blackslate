//! Unit tests for `parse_frontmatter`, `decode_project_key`, and `plugin_display_source`.
//!
//! All three are pure string-in / value-out functions with no I/O, so every test is
//! deterministic and runs in under a microsecond.

// ─── parse_frontmatter ────────────────────────────────────────────────────────

/// **What:** Passes a string with no `---` prefix at all.
/// **Why:** Content without frontmatter is valid (plain markdown files); the parser must
/// return an empty map rather than panic on `strip_prefix`. Every `skill_from_path`
/// lookup that follows falls back to the filename, which is the correct behaviour.
#[test]
fn no_frontmatter_prefix_returns_empty_map() {
    let content = "This is a regular markdown file.\n# Heading\n";
    let fm = super::parse_frontmatter(content);
    assert!(fm.is_empty());
}

/// **What:** Passes content that starts with `---` but has no closing `\n---` marker.
/// **Why:** `close` defaults to 0 when `.find("\n---")` fails, so `after_open[..0]` is an
/// empty slice — no lines are iterated. This test locks that "missing close = empty"
/// contract so a future refactor does not accidentally parse unterminated frontmatter.
#[test]
fn open_marker_without_close_returns_empty_map() {
    let content = "---\nname: broken\ndescription: never closed\n";
    let fm = super::parse_frontmatter(content);
    assert!(fm.is_empty());
}

/// **What:** Parses a well-formed frontmatter block with `name`, `description`, and `version`.
/// **Why:** The happy path that every real SKILL.md follows. Ensures all three fields are
/// extracted correctly so the skills sidebar shows accurate metadata.
#[test]
fn standard_frontmatter_all_fields_extracted() {
    let content = "---\nname: My Skill\ndescription: Does something useful\nversion: 1.2.3\n---\n# Body";
    let fm = super::parse_frontmatter(content);
    assert_eq!(fm.get("name").map(String::as_str), Some("My Skill"));
    assert_eq!(fm.get("description").map(String::as_str), Some("Does something useful"));
    assert_eq!(fm.get("version").map(String::as_str), Some("1.2.3"));
}

/// **What:** Parses a value wrapped in double quotes.
/// **Why:** YAML allows quoting; Claude Code skill authors use it when values contain
/// special characters. The parser strips the outer `"…"` so the UI never shows literal
/// quote characters in a skill name or description.
#[test]
fn double_quoted_value_strips_quotes() {
    let content = "---\nname: \"Quoted Name\"\n---\n";
    let fm = super::parse_frontmatter(content);
    assert_eq!(fm.get("name").map(String::as_str), Some("Quoted Name"));
}

/// **What:** Parses a value wrapped in single quotes.
/// **Why:** Same as double-quote test but for the single-quote variant. Both must be
/// stripped; if only one is handled the other leaks into the display label.
#[test]
fn single_quoted_value_strips_quotes() {
    let content = "---\nname: 'Single Quoted'\n---\n";
    let fm = super::parse_frontmatter(content);
    assert_eq!(fm.get("name").map(String::as_str), Some("Single Quoted"));
}

/// **What:** Parses a value that itself contains a colon (e.g. a URL or label).
/// **Why:** `line.find(':')` returns the *first* colon index. Everything after that —
/// including additional colons — must be kept as part of the value. A naive split would
/// silently truncate values like `url: https://example.com` to just `https`.
#[test]
fn value_containing_colon_uses_first_colon_as_split() {
    let content = "---\nwebsite: https://example.com/path\n---\n";
    let fm = super::parse_frontmatter(content);
    assert_eq!(
        fm.get("website").map(String::as_str),
        Some("https://example.com/path")
    );
}

/// **What:** Passes a line where the key is empty (`: value`).
/// **Why:** The parser guards `if !key.is_empty()` before inserting. This test verifies
/// that guard works — an empty key must not be inserted as `""` in the map, as that
/// would hide the entry or cause a spurious `name` fallback to look up the wrong key.
#[test]
fn empty_key_is_not_inserted_into_map() {
    let content = "---\n: some value\nname: valid\n---\n";
    let fm = super::parse_frontmatter(content);
    assert!(!fm.contains_key(""));
    assert_eq!(fm.get("name").map(String::as_str), Some("valid"));
}

/// **What:** Parses a key and value that have surrounding whitespace.
/// **Why:** Both key and value are trimmed. Without trimming, `"  name "` would not match
/// the `fm.get("name")` lookup, and value whitespace would leak into the skills panel.
#[test]
fn whitespace_around_key_and_value_is_trimmed() {
    let content = "---\n  name :  Trimmed Value  \n---\n";
    let fm = super::parse_frontmatter(content);
    assert_eq!(fm.get("name").map(String::as_str), Some("Trimmed Value"));
}

/// **What:** Puts extra content after the closing `\n---` marker and verifies it is ignored.
/// **Why:** Frontmatter is strictly bounded. Body text (or a second YAML block) after `---`
/// must not be parsed as metadata; a regression here would inject random markdown content
/// as fake skill fields.
#[test]
fn content_after_closing_marker_is_ignored() {
    let content = "---\nname: Real\n---\nname: Fake\nversion: 9.9.9\n";
    let fm = super::parse_frontmatter(content);
    assert_eq!(fm.get("name").map(String::as_str), Some("Real"));
    assert!(fm.get("version").is_none());
}

// ─── decode_project_key ───────────────────────────────────────────────────────

/// **What:** Decodes a typical Claude Code project key for a nested path.
/// **Why:** The encoding replaces every `/` with `-`; decoding reverses that. If a dash
/// is left un-replaced the path lookup fails and the project never appears in the list.
#[test]
fn typical_nested_path_decoded_correctly() {
    assert_eq!(
        super::decode_project_key("-Users-kannan-Projects-Slate"),
        "/Users/kannan/Projects/Slate"
    );
}

/// **What:** Decodes a short two-component path.
/// **Why:** Corner-case for shallow paths; the logic must work for any depth including
/// top-level directories like `/tmp/foo`.
#[test]
fn shallow_path_decoded_correctly() {
    assert_eq!(super::decode_project_key("-tmp-foo"), "/tmp/foo");
}

/// **What:** Decodes a project key where the original directory name contained a hyphen.
/// **Why:** Documents a known limitation: Claude Code encodes `/` as `-`, so a project
/// at `/Users/dev/my-app` produces key `-Users-dev-my-app` and decodes as
/// `/Users/dev/my/app` (wrong). This test locks the *current* behaviour so we know if
/// it ever changes upstream.
#[test]
fn hyphenated_directory_name_decodes_with_known_limitation() {
    // my-app has a real hyphen; it cannot be round-tripped through this encoding.
    let decoded = super::decode_project_key("-Users-dev-my-app");
    assert_eq!(decoded, "/Users/dev/my/app"); // limitation: my-app → my/app
}

// ─── plugin_display_source ────────────────────────────────────────────────────

/// **What:** Extracts the name portion from a versioned plugin key (`name@version`).
/// **Why:** Claude Code plugin keys are `package@semver`; the UI should show `package`
/// only. A regression that returns the full key would show version numbers in the
/// source label, making the skills panel noisy.
#[test]
fn versioned_plugin_key_returns_name_before_at() {
    assert_eq!(super::plugin_display_source("my-plugin@1.2.3"), "my-plugin");
}

/// **What:** Returns the key unchanged when there is no `@` in it.
/// **Why:** Some plugins may be registered without a version. The `.unwrap_or(plugin_key)`
/// fallback must fire; without it we'd get an empty string or panic.
#[test]
fn unversioned_plugin_key_returned_as_is() {
    assert_eq!(super::plugin_display_source("my-plugin"), "my-plugin");
}

/// **What:** Handles a scoped npm-style key like `@scope/plugin` (leading `@`).
/// **Why:** `split('@')` on `"@scope/plugin"` yields `["", "scope/plugin"]`; `.next()` is
/// `""`. This is the current documented behaviour — the test pins it so we notice if
/// we later fix it to return `"scope/plugin"` instead.
#[test]
fn scoped_npm_key_returns_empty_string_before_first_at() {
    // Known limitation: @scope/plugin → "" because the first split segment is empty.
    assert_eq!(super::plugin_display_source("@anthropic/claude-hooks"), "");
}

/// **What:** Handles a scoped AND versioned key (`@scope/pkg@1.0.0`).
/// **Why:** Same leading-`@` limitation applies. The first segment is still empty. This
/// test documents both the format and the current output together.
#[test]
fn scoped_and_versioned_key_returns_empty_string() {
    assert_eq!(super::plugin_display_source("@scope/plugin@2.0.0"), "");
}
