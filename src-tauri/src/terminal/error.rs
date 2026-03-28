/// All terminal commands return this type.
/// `String` as the error satisfies Tauri's requirement that errors are serializable.
/// Internally we use `anyhow::Error` and convert at the command boundary.
pub type CommandResult<T> = Result<T, String>;

/// Convert any `anyhow::Error` (or anything that implements `Display`) into a
/// `CommandResult` error.  Call site: `some_op().map_err(cmd_err)?`
pub fn cmd_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}
