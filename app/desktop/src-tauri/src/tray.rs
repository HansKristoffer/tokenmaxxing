//! The menu bar: the bolt with today's tokens next to it ("306M"), and a menu to open the world,
//! see where you stand, sync, launch at login, update and quit. It's rebuilt whenever the helper
//! reports new numbers.

use crate::helper::{Helper, State};
use crate::updates::{self, Status};
use crate::{world, Shared};
use serde_json::json;
use std::sync::Arc;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

const ID: &str = "main";

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id(ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        // Black on clear, so macOS tints it for light and dark menu bars.
        .icon_as_template(true)
        .tooltip("Tokenmaxxing")
        .menu(&menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(on_menu)
        .build(app)?;
    Ok(())
}

/// New numbers or an update: a new title and menu.
pub fn refresh(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(ID) else {
        return;
    };
    let title = title(&app.state::<Shared>().lock().unwrap().state);
    let _ = tray.set_title(title);
    match menu(app) {
        Ok(menu) => {
            let _ = tray.set_menu(Some(menu));
        }
        Err(e) => log::error!("could not build the menu: {e}"),
    }
}

fn title(state: &State) -> Option<String> {
    state.today.as_ref().map(|t| compact(t.tokens))
}

fn menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let ui = app.state::<Shared>();
    let ui = ui.lock().unwrap();
    let mut items: Vec<Box<dyn IsMenuItem<Wry>>> = Vec::new();
    let item = |id: &str, text: &str, enabled: bool, key: Option<&str>| {
        MenuItem::with_id(app, id, text, enabled, key)
    };

    if ui.state.phase == "ready" {
        items.push(Box::new(item(
            "open",
            "Open world",
            true,
            Some("CmdOrCtrl+O"),
        )?));
        if let Some(line) = today_line(&ui.state) {
            items.push(Box::new(item("today", &line, false, None)?));
        }
        if let Some(line) = battle_line(&ui.state, now_ms()) {
            items.push(Box::new(item("battle", &line, false, None)?));
        }
        items.push(Box::new(PredefinedMenuItem::separator(app)?));
        items.push(Box::new(item("sync", "Sync now", true, None)?));
    } else {
        items.push(Box::new(item("open", "Pick a name…", true, None)?));
        items.push(Box::new(PredefinedMenuItem::separator(app)?));
    }
    let at_login = app.autolaunch().is_enabled().unwrap_or(false);
    items.push(Box::new(CheckMenuItem::with_id(
        app,
        "login",
        "Launch at login",
        true,
        at_login,
        None::<&str>,
    )?));
    let (update_text, update_enabled) = match &ui.update {
        Status::Unknown => ("Check for updates…".to_string(), true),
        Status::Checking => ("Checking for updates…".to_string(), false),
        Status::Current => ("Tokenmaxxing is up to date".to_string(), true),
        Status::Available(update) => (format!("Update to {}…", update.version), true),
        Status::Installing => ("Installing the update…".to_string(), false),
    };
    items.push(Box::new(item(
        "update",
        &update_text,
        update_enabled,
        None,
    )?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(item(
        "quit",
        "Quit Tokenmaxxing",
        true,
        Some("CmdOrCtrl+Q"),
    )?));

    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i.as_ref()).collect();
    Menu::with_items(app, &refs)
}

fn on_menu(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "open" => world::open(app),
        "sync" => {
            let helper = app.state::<Arc<Helper>>().inner().clone();
            std::thread::spawn(move || {
                if let Err(e) = helper.call(json!({ "cmd": "syncNow" })) {
                    log::warn!("sync now: {e}");
                }
            });
        }
        "login" => {
            let launcher = app.autolaunch();
            let on = launcher.is_enabled().unwrap_or(false);
            let result = if on {
                launcher.disable()
            } else {
                launcher.enable()
            };
            if let Err(e) = result {
                log::warn!("launch at login: {e}");
            }
            refresh(app);
        }
        "update" => updates::from_menu(app),
        "quit" => app.exit(0),
        _ => {}
    }
}

fn today_line(state: &State) -> Option<String> {
    let today = state.today.as_ref()?;
    if today.tokens == 0.0 {
        return Some(format!("No tokens yet today · Lv{}", today.level));
    }
    let rank = today
        .rank
        .map(|r| format!(" · #{r} in town"))
        .unwrap_or_default();
    Some(format!(
        "{} today{rank} · Lv{}",
        compact(today.tokens),
        today.level
    ))
}

/// "🏁 Tokenmaxxing · 2nd of 4 · 18:42 left". It updates with every sync, which is every 10 s in a battle.
fn battle_line(state: &State, now: f64) -> Option<String> {
    let b = state.battle.as_ref()?;
    let place = b
        .place
        .map(|p| format!(" · {} of {}", ordinal(p), b.players))
        .unwrap_or_default();
    let time = if now < b.ends_at {
        format!("{} left", clock(b.ends_at - now))
    } else {
        "counting…".to_string()
    };
    Some(format!(
        "🏁 {}{place} · {time} · {}",
        b.name,
        compact(b.tokens)
    ))
}

fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}

/// As core/src/format.ts: 306.0M, 1.5B, 12.3K.
fn compact(n: f64) -> String {
    let a = n.abs();
    if a >= 1e12 {
        format!("{:.1}T", n / 1e12)
    } else if a >= 1e9 {
        format!("{:.1}B", n / 1e9)
    } else if a >= 1e6 {
        format!("{:.1}M", n / 1e6)
    } else if a >= 1e3 {
        format!("{:.1}K", n / 1e3)
    } else {
        format!("{}", n.round())
    }
}

fn ordinal(n: u32) -> String {
    let suffix = match n {
        1 => "st",
        2 => "nd",
        3 => "rd",
        _ => "th",
    };
    format!("{n}{suffix}")
}

/// "18:42", or "3:04:05" past an hour.
fn clock(ms: f64) -> String {
    let s = (ms.max(0.0) / 1000.0) as u64;
    let (h, m, sec) = (s / 3600, s % 3600 / 60, s % 60);
    if h > 0 {
        format!("{h}:{m:02}:{sec:02}")
    } else {
        format!("{m}:{sec:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::helper::{Battle, Today};

    #[test]
    fn the_menu_bar_reads_like_the_game() {
        assert_eq!(compact(306_000_000.0), "306.0M");
        assert_eq!(compact(1_500_000_000.0), "1.5B");
        assert_eq!(compact(999.0), "999");
        assert_eq!(clock(65_000.0), "1:05");
        assert_eq!(clock(3_725_000.0), "1:02:05");
        let state = State {
            phase: "ready".into(),
            today: Some(Today {
                tokens: 306_000_000.0,
                rank: Some(2),
                level: 5,
            }),
            battle: Some(Battle {
                name: "Tokenmaxxing".into(),
                place: Some(2),
                players: 4,
                tokens: 412_000_000.0,
                ends_at: 1_000_000.0,
                until: 1_180_000.0,
            }),
        };
        assert_eq!(title(&state).as_deref(), Some("306.0M"));
        assert_eq!(
            today_line(&state).unwrap(),
            "306.0M today · #2 in town · Lv5"
        );
        assert_eq!(
            battle_line(&state, 0.0).unwrap(),
            "🏁 Tokenmaxxing · 2nd of 4 · 16:40 left · 412.0M"
        );
        assert_eq!(
            battle_line(&state, 2_000_000.0).unwrap(),
            "🏁 Tokenmaxxing · 2nd of 4 · counting… · 412.0M"
        );
    }
}
