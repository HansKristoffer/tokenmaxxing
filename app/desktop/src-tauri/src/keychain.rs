//! The device token. On macOS it's in the login Keychain under the same service and account the Swift
//! app used, so people who upgrade stay signed in; macOS lets the new app read it because it's signed by
//! the same team with the same identifier. On Windows it's in Credential Manager and on Linux in the
//! Secret Service (GNOME Keyring, KWallet), under the same names; with no Secret Service running (a bare
//! window manager, a headless box) it's a file only its user can read, in the app's state directory.
//! Nothing here panics: a token that can't be read means signing up again, one that can't be saved is
//! logged. Dev builds use their own entry and never touch the real account.

const ACCOUNT: &str = "api-token";

const SERVICE: &str = if cfg!(debug_assertions) {
    "dk.hanskristoffer.tokenmaxxing.dev"
} else {
    "dk.hanskristoffer.tokenmaxxing"
};

#[cfg(target_os = "macos")]
pub use mac::{delete, get, set};

#[cfg(not(target_os = "macos"))]
pub use other::{delete, get, set};

#[cfg(target_os = "macos")]
mod mac {
    use super::{ACCOUNT, SERVICE};
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };

    pub fn get() -> Option<String> {
        get_generic_password(SERVICE, ACCOUNT)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    }

    pub fn set(token: &str) {
        if let Err(e) = set_generic_password(SERVICE, ACCOUNT, token.as_bytes()) {
            log::error!("could not save the token: {e}");
        }
    }

    pub fn delete() {
        let _ = delete_generic_password(SERVICE, ACCOUNT);
    }
}

#[cfg(not(target_os = "macos"))]
mod other {
    use super::{ACCOUNT, SERVICE};
    use std::path::Path;

    fn entry() -> keyring::Result<keyring::Entry> {
        keyring::Entry::new(SERVICE, ACCOUNT)
    }

    fn file_dir() -> std::path::PathBuf {
        crate::paths::state_dir()
    }

    pub fn get() -> Option<String> {
        match entry().and_then(|e| e.get_password()) {
            Ok(token) => return Some(token),
            Err(keyring::Error::NoEntry) => {}
            Err(e) => log::warn!("the system keyring isn't available ({e}); using the token file"),
        }
        file_get(&file_dir())
    }

    pub fn set(token: &str) {
        match entry().and_then(|e| e.set_password(token)) {
            Ok(()) => {
                // A file left from a time the keyring was down is stale now.
                file_delete(&file_dir());
                return;
            }
            Err(e) => log::warn!("the system keyring isn't available ({e}); saving the token to a file"),
        }
        if let Err(e) = file_set(&file_dir(), token) {
            log::error!("could not save the token: {e}");
        }
    }

    pub fn delete() {
        match entry().and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => log::warn!("could not remove the token from the keyring: {e}"),
        }
        file_delete(&file_dir());
    }

    const FILE: &str = "token";

    pub(super) fn file_get(dir: &Path) -> Option<String> {
        let token = std::fs::read_to_string(dir.join(FILE)).ok()?;
        let token = token.trim();
        (!token.is_empty()).then(|| token.to_string())
    }

    /// Written readable by its user only (on Windows it inherits the profile's access list, which is
    /// already that).
    pub(super) fn file_set(dir: &Path, token: &str) -> std::io::Result<()> {
        use std::io::Write;
        std::fs::create_dir_all(dir)?;
        let path = dir.join(FILE);
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&path)?;
        #[cfg(unix)]
        {
            // `mode` only applies to a new file; an older one may be looser.
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
        }
        file.write_all(token.as_bytes())
    }

    pub(super) fn file_delete(dir: &Path) {
        let _ = std::fs::remove_file(dir.join(FILE));
    }
}

#[cfg(all(test, not(target_os = "macos")))]
mod tests {
    use super::other::{file_delete, file_get, file_set};

    #[test]
    fn the_token_file_round_trips_and_is_private() {
        let dir = std::env::temp_dir().join(format!("tokenmaxxing-keychain-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(file_get(&dir), None);
        file_set(&dir, "12.tok_abc").unwrap();
        assert_eq!(file_get(&dir).as_deref(), Some("12.tok_abc"));
        // A shorter token replaces the whole file.
        file_set(&dir, "1.x").unwrap();
        assert_eq!(file_get(&dir).as_deref(), Some("1.x"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(dir.join("token")).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        file_delete(&dir);
        assert_eq!(file_get(&dir), None);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
