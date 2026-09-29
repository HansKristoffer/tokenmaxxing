//! Tokenmaxxing for the desktop: a menu bar app that keeps your usage in sync (the helper) and shows
//! today's count, with a window for the game itself. The window loads the live game from the server,
//! so it updates with every server deploy; the app only updates for changes to itself.

mod helper;
mod keychain;
mod tray;
mod updates;
mod world;

use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

/// The server the app talks to, baked in at build time; dev builds use a local one (see build.rs).
pub const SERVER_URL: &str = match option_env!("TOKENMAXXING_SERVER_URL") {
    Some(url) => url,
    None => "http://localhost:8787",
};

/// What the menu shows, kept so it can be rebuilt when anything changes.
#[derive(Default)]
pub struct Ui {
    pub state: helper::State,
    pub update: updates::Status,
}

pub type Shared = Mutex<Ui>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First: a second launch (from the Dock, Spotlight or a login item) opens the world in the
        // running app instead of starting another.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            world::open(app)
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("tokenmaxxing".into()),
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&[world::ONBOARDING])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Shared::default())
        .invoke_handler(tauri::generate_handler![world::sign_up])
        .setup(|app| {
            // Menu bar only until a window opens (Info.plist has LSUIElement too).
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            tray::build(app.handle())?;
            let events = app.handle().clone();
            let helper = helper::Helper::start(
                move |message| on_helper(&events, message),
                || json!({ "cmd": "init", "token": keychain::get(), "serverUrl": SERVER_URL }),
            );
            app.manage(helper);
            updates::watch(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                world::closed(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the app")
        .run(|app, event| match event {
            // Closing the last window keeps the menu bar app running; Quit (an explicit exit code) doesn't.
            RunEvent::ExitRequested {
                api, code: None, ..
            } => api.prevent_exit(),
            RunEvent::Exit => app.state::<Arc<helper::Helper>>().stop(),
            _ => {}
        });
}

fn on_helper(app: &tauri::AppHandle, message: helper::Message) {
    match message {
        helper::Message::State(state) => {
            let onboarding = state.phase == "onboarding";
            app.state::<Shared>().lock().unwrap().state = state;
            tray::refresh(app);
            if onboarding {
                world::onboard(app);
            }
        }
        helper::Message::Token(Some(token)) => keychain::set(&token),
        helper::Message::Token(None) => keychain::delete(),
        helper::Message::Reply { .. } => {}
    }
}
