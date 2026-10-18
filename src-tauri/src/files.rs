use std::{
    fs::File,
    io::{Read, Write},
    path::Path,
};
pub const MAX_FILE_BYTES: usize = 16 * 1024 * 1024;
pub fn read_text(path: &Path) -> Result<String, String> {
    let mut text = String::new();
    File::open(path)
        .map_err(|e| e.to_string())?
        .take((MAX_FILE_BYTES + 1) as u64)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;
    if text.len() > MAX_FILE_BYTES {
        return Err("File exceeds 16 MiB".into());
    }
    Ok(text)
}
pub fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    if content.len() > MAX_FILE_BYTES {
        return Err("File exceeds 16 MiB".into());
    }
    let parent = path.parent().ok_or("Invalid destination")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temporary
        .write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    // The temporary file is created owner-only; keep the destination's mode, or use a normal document mode.
    let permissions = std::fs::metadata(path)
        .map(|metadata| metadata.permissions())
        .ok()
        .or_else(default_permissions);
    if let Some(permissions) = permissions {
        temporary
            .as_file()
            .set_permissions(permissions)
            .map_err(|e| e.to_string())?;
    }
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(unix)]
fn default_permissions() -> Option<std::fs::Permissions> {
    use std::os::unix::fs::PermissionsExt;
    Some(std::fs::Permissions::from_mode(0o644))
}
#[cfg(not(unix))]
fn default_permissions() -> Option<std::fs::Permissions> {
    None
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn overwrite_and_failure_preserve_document() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chart.json");
        atomic_write(&path, "first").unwrap();
        atomic_write(&path, "second").unwrap();
        assert_eq!(read_text(&path).unwrap(), "second");
        assert!(atomic_write(&path, &"x".repeat(MAX_FILE_BYTES + 1)).is_err());
        assert_eq!(read_text(&path).unwrap(), "second");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn read_rejects_invalid_utf8_and_oversize() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.json");
        std::fs::write(&path, [0xff]).unwrap();
        assert!(read_text(&path).is_err());
        std::fs::write(&path, vec![b'x'; MAX_FILE_BYTES + 1]).unwrap();
        assert!(read_text(&path).is_err());
    }
    #[cfg(unix)]
    #[test]
    fn write_keeps_or_sets_document_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chart.json");
        atomic_write(&path, "first").unwrap();
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o644);
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o664)).unwrap();
        atomic_write(&path, "second").unwrap();
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o664);
    }
}
