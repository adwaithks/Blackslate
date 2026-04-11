use std::path::PathBuf;
use std::{fs, io};

fn main() {
    tauri_build::build();
    if let Err(e) = sync_rg_sidecar_to_target_dir() {
        println!(
            "cargo:warning=failed to sync rg sidecar for dev ({}); wiki picker may fail until you run `bun run setup:rg` and rebuild",
            e
        );
    }
}

/// `tauri dev` runs the app from `target/debug/`, but `externalBin` only names files under
/// `src-tauri/binaries/`. The shell plugin resolves `binaries/rg` next to the executable, so copy
/// the triple-named artifact into `target/{profile}/binaries/rg` on every build.
fn sync_rg_sidecar_to_target_dir() -> io::Result<()> {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidInput, e.to_string())
    })?);
    let target_triple = std::env::var("TARGET").map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidInput, e.to_string())
    })?;
    let profile = std::env::var("PROFILE").map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidInput, e.to_string())
    })?;

    let src_name = if target_triple.contains("windows") {
        format!("rg-{target_triple}.exe")
    } else {
        format!("rg-{target_triple}")
    };
    let src = manifest_dir.join("binaries").join(&src_name);
    if !src.is_file() {
        return Ok(());
    }

    let target_root = std::env::var("CARGO_TARGET_DIR").map_or_else(
        |_| manifest_dir.join("target"),
        PathBuf::from,
    );
    let out_dir = target_root.join(&profile).join("binaries");
    fs::create_dir_all(&out_dir)?;

    let dest_name = if target_triple.contains("windows") {
        "rg.exe"
    } else {
        "rg"
    };
    let dest = out_dir.join(dest_name);
    fs::copy(&src, &dest)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&dest)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&dest, perms)?;
    }

    println!("cargo:rerun-if-changed={}", src.display());
    Ok(())
}
