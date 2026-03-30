/// Opens a native macOS folder picker (multiple-select) via osascript.
/// Returns the selected POSIX paths, or an empty vec on cancel / error.
#[tauri::command]
pub async fn pick_folders() -> Vec<String> {
    let script = r#"try
    set theChosenFolders to choose folder with prompt "Select git repositories:" with multiple selections allowed
    set output to ""
    repeat with aFolder in theChosenFolders
        set output to output & POSIX path of aFolder & "\n"
    end repeat
    return output
on error
    return ""
end try"#;

    let result = tokio::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .await;

    match result {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout).into_owned();
            raw.lines()
                .map(|l| l.trim().trim_end_matches('/').to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        Err(_) => vec![],
    }
}
