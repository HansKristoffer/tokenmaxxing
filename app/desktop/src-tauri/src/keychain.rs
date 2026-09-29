//! The device token, in the login Keychain under the same service and account the Swift app used, so
//! people who upgrade stay signed in. macOS lets the new app read it because it's signed by the same
//! team with the same identifier. Dev builds use their own entry and never touch the real account.

use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const ACCOUNT: &str = "api-token";

const SERVICE: &str = if cfg!(debug_assertions) {
    "dk.hanskristoffer.tokenmaxxing.dev"
} else {
    "dk.hanskristoffer.tokenmaxxing"
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
