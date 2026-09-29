//! The windows: the game (the server's page) and, until there's an account, the local "pick a name"
//! page. The app shows in the Dock only while one of them is open.

use crate::helper::Helper;
use crate::{Shared, SERVER_URL};
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

pub const WORLD: &str = "world";
pub const ONBOARDING: &str = "onboarding";

/// Opens the game, or brings it to the front. Signs the page in with a single-use code from the
/// helper, just as the browser was; without one (offline) it opens anyway, on the session it kept.
pub fn open(app: &AppHandle) {
    if focus(app, WORLD) {
        return;
    }
    if app.state::<Shared>().lock().unwrap().state.phase != "ready" {
        onboard(app);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let helper = app.state::<Arc<Helper>>().inner().clone();
        let url = match helper.call(json!({ "cmd": "openWorld" })) {
            Ok(result) => result["url"].as_str().map(String::from),
            Err(e) => {
                log::warn!("no login code ({e}); opening the world on its saved session");
                None
            }
        };
        let url = url.unwrap_or_else(|| format!("{SERVER_URL}/play"));
        if let Err(e) = world_window(&app, &url) {
            log::error!("could not open the world: {e}");
        }
    });
}

fn world_window(app: &AppHandle, url: &str) -> Result<(), String> {
    let url: Url = url
        .parse()
        .map_err(|e| format!("bad world url {url}: {e}"))?;
    let origin = url.origin();
    let links = app.clone();
    let new_windows = app.clone();
    WebviewWindowBuilder::new(app, WORLD, WebviewUrl::External(url))
        .title("Tokenmaxxing")
        .inner_size(1280.0, 800.0)
        .min_inner_size(720.0, 480.0)
        // The window stays on the game; any other link (a company's website) opens in the browser.
        .on_navigation(move |to| {
            if to.origin() == origin {
                return true;
            }
            if let Err(e) = links.opener().open_url(to.as_str(), None::<&str>) {
                log::warn!("could not open {to}: {e}");
            }
            false
        })
        // A link that asks for a new window (a company's website): the browser, not another app window.
        .on_new_window(move |to, _| {
            if let Err(e) = new_windows.opener().open_url(to.as_str(), None::<&str>) {
                log::warn!("could not open {to}: {e}");
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| e.to_string())?;
    shown(app);
    Ok(())
}

/// The "pick a name" page, the only one that can call into the app (see capabilities/default.json).
pub fn onboard(app: &AppHandle) {
    if focus(app, ONBOARDING) {
        return;
    }
    let built = WebviewWindowBuilder::new(app, ONBOARDING, WebviewUrl::App("index.html".into()))
        .title("Welcome to Tokenmaxxing")
        .inner_size(420.0, 380.0)
        .resizable(false)
        .center()
        .build();
    match built {
        Ok(_) => shown(app),
        Err(e) => log::error!("could not open onboarding: {e}"),
    }
}

/// From the onboarding page. Errors come back as the helper's codes (name_taken, offline, …).
#[tauri::command]
pub async fn sign_up(app: AppHandle, name: String) -> Result<(), String> {
    let helper = app.state::<Arc<Helper>>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        helper.call(json!({ "cmd": "signUp", "name": name }))
    })
    .await
    .map_err(|_| "internal".to_string())??;
    // The helper's own state event may still be on its way; the world opens now.
    app.state::<Shared>().lock().unwrap().state.phase = "ready".into();
    // A new account starts at login, as the menu bar app always did.
    if let Err(e) = app.autolaunch().enable() {
        log::warn!("could not turn on launch at login: {e}");
    }
    // Destroy, not close: this call came from that very window, and a close can be vetoed.
    if let Some(window) = app.get_webview_window(ONBOARDING) {
        let _ = window.destroy();
    }
    open(&app);
    Ok(())
}

/// A window closed: back to the menu bar only once none are left.
pub fn closed(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    if app.webview_windows().is_empty() {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    }
}

fn shown(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    let _ = app.show();
}

/// Brings an open window to the front; false if it isn't open.
fn focus(app: &AppHandle, label: &str) -> bool {
    let Some(window) = app.get_webview_window(label) else {
        return false;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    shown(app);
    true
}
