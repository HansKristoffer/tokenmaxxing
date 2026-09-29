//! Self-update: the app checks this repo's latest GitHub release (latest.json) on launch and every
//! four hours, and offers the update in the menu. Downloads are verified against the public key in
//! tauri.conf.json before they're installed, then the app restarts. Dev builds never check.

use crate::{tray, Shared};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

const EVERY: Duration = Duration::from_secs(4 * 60 * 60);

#[derive(Default)]
pub enum Status {
    #[default]
    Unknown,
    Checking,
    Current,
    Available(Box<Update>),
    Installing,
}

pub fn watch(app: AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    std::thread::spawn(move || loop {
        tauri::async_runtime::block_on(check(&app));
        std::thread::sleep(EVERY);
    });
}

/// "Check for updates…" checks now; "Update to X.Y.Z…" installs it and restarts.
pub fn from_menu(app: &AppHandle) {
    let app = app.clone();
    let found = match std::mem::take(&mut app.state::<Shared>().lock().unwrap().update) {
        Status::Available(update) => Some(update),
        _ => None,
    };
    tauri::async_runtime::spawn(async move {
        match found {
            Some(update) => install(&app, *update).await,
            None => check(&app).await,
        }
    });
}

async fn check(app: &AppHandle) {
    set(app, Status::Checking);
    let status = match app.updater().map(|u| async move { u.check().await }) {
        Ok(checking) => match checking.await {
            Ok(Some(update)) => Status::Available(Box::new(update)),
            Ok(None) => Status::Current,
            Err(e) => {
                log::warn!("update check failed: {e}");
                Status::Unknown
            }
        },
        Err(e) => {
            log::warn!("no updater: {e}");
            Status::Unknown
        }
    };
    set(app, status);
}

async fn install(app: &AppHandle, update: Update) {
    let version = update.version.clone();
    set(app, Status::Installing);
    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            log::info!("updated to {version}; restarting");
            app.restart();
        }
        Err(e) => {
            log::error!("could not install {version}: {e}");
            set(app, Status::Unknown);
        }
    }
}

fn set(app: &AppHandle, status: Status) {
    app.state::<Shared>().lock().unwrap().update = status;
    tray::refresh(app);
}
