//! Where the app keeps its files on each OS, the same directories as app/helper/src/paths.ts (the helper
//! writes there, this side reads them: the log, and the token when there's no keychain).
//!
//!   macOS    ~/Library/Application Support/Tokenmaxxing, ~/Library/Logs/Tokenmaxxing (unchanged, so
//!            upgrades keep their state)
//!   Windows  %APPDATA%\Tokenmaxxing, %LOCALAPPDATA%\Tokenmaxxing\Logs
//!   Linux    $XDG_STATE_HOME/tokenmaxxing (~/.local/state), logs in its `logs` directory
//!
//! Dev builds get a directory of their own beside the real one, so they never touch the installed app's
//! account or read positions.

use std::path::{Path, PathBuf};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Os {
    Mac,
    Windows,
    Linux,
}

const OS: Os = if cfg!(target_os = "macos") {
    Os::Mac
} else if cfg!(windows) {
    Os::Windows
} else {
    Os::Linux
};

/// The user's home directory.
pub fn home() -> PathBuf {
    let var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    PathBuf::from(std::env::var(var).unwrap_or_default())
}

/// The variable's value, if it is set to something.
fn var(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

/// This build's state directory: the installed app's, or the dev build's.
pub fn state_dir() -> PathBuf {
    state_dir_for(OS, &var, &home(), cfg!(debug_assertions))
}

/// This build's log directory.
pub fn log_dir() -> PathBuf {
    log_dir_for(OS, &var, &home())
}

pub fn state_dir_for(
    os: Os,
    env: &dyn Fn(&str) -> Option<PathBuf>,
    home: &Path,
    dev: bool,
) -> PathBuf {
    let name = |plain: &'static str, dev_name: &'static str| -> &'static str {
        if dev {
            dev_name
        } else {
            plain
        }
    };
    match os {
        Os::Mac => home
            .join("Library")
            .join("Application Support")
            .join(name("Tokenmaxxing", "Tokenmaxxing Dev")),
        Os::Windows => env("APPDATA")
            .unwrap_or_else(|| home.join("AppData").join("Roaming"))
            .join(name("Tokenmaxxing", "Tokenmaxxing Dev")),
        Os::Linux => env("XDG_STATE_HOME")
            .unwrap_or_else(|| home.join(".local").join("state"))
            .join(name("tokenmaxxing", "tokenmaxxing-dev")),
    }
}

pub fn log_dir_for(os: Os, env: &dyn Fn(&str) -> Option<PathBuf>, home: &Path) -> PathBuf {
    match os {
        Os::Mac => home.join("Library").join("Logs").join("Tokenmaxxing"),
        Os::Windows => env("LOCALAPPDATA")
            .unwrap_or_else(|| home.join("AppData").join("Local"))
            .join("Tokenmaxxing")
            .join("Logs"),
        Os::Linux => state_dir_for(os, env, home, false).join("logs"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn none(_: &str) -> Option<PathBuf> {
        None
    }

    #[test]
    fn macos_keeps_the_paths_every_release_used() {
        let home = Path::new("/Users/ann");
        assert_eq!(
            state_dir_for(Os::Mac, &none, home, false),
            home.join("Library/Application Support/Tokenmaxxing")
        );
        assert_eq!(
            state_dir_for(Os::Mac, &none, home, true),
            home.join("Library/Application Support/Tokenmaxxing Dev")
        );
        assert_eq!(
            log_dir_for(Os::Mac, &none, home),
            home.join("Library/Logs/Tokenmaxxing")
        );
    }

    #[test]
    fn windows_uses_appdata_and_localappdata() {
        let home = Path::new("C:/Users/Ann");
        let env = |k: &str| match k {
            "APPDATA" => Some(PathBuf::from("D:/Roam")),
            "LOCALAPPDATA" => Some(PathBuf::from("D:/Loc")),
            _ => None,
        };
        assert_eq!(
            state_dir_for(Os::Windows, &env, home, false),
            Path::new("D:/Roam/Tokenmaxxing")
        );
        assert_eq!(
            state_dir_for(Os::Windows, &env, home, true),
            Path::new("D:/Roam/Tokenmaxxing Dev")
        );
        assert_eq!(
            log_dir_for(Os::Windows, &env, home),
            Path::new("D:/Loc/Tokenmaxxing/Logs")
        );
        assert_eq!(
            state_dir_for(Os::Windows, &none, home, false),
            home.join("AppData/Roaming/Tokenmaxxing")
        );
        assert_eq!(
            log_dir_for(Os::Windows, &none, home),
            home.join("AppData/Local/Tokenmaxxing/Logs")
        );
    }

    #[test]
    fn linux_follows_xdg_state_home() {
        let home = Path::new("/home/ann");
        assert_eq!(
            state_dir_for(Os::Linux, &none, home, false),
            home.join(".local/state/tokenmaxxing")
        );
        assert_eq!(
            log_dir_for(Os::Linux, &none, home),
            home.join(".local/state/tokenmaxxing/logs")
        );
        let env = |k: &str| (k == "XDG_STATE_HOME").then(|| PathBuf::from("/s"));
        assert_eq!(
            state_dir_for(Os::Linux, &env, home, true),
            Path::new("/s/tokenmaxxing-dev")
        );
        // Dev builds log with the installed app's, as they always have.
        assert_eq!(
            log_dir_for(Os::Linux, &env, home),
            Path::new("/s/tokenmaxxing/logs")
        );
    }
}
