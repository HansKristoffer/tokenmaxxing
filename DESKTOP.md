# Plan: a desktop app for the game, with the menu bar app inside it

Today the menu bar app (a Swift shell around a Bun helper) syncs your usage, and **Open world** opens the game
in your browser. This plan puts the game in its own desktop window, built with **Tauri v2**, and keeps the menu
bar part: it stays in sync in the background and shows your token count next to its icon. Both ship as one
download and update together.

It borrows from **Wallflower** (`~/Documents/GitHub/voice-to-grok-bot`), which already has a working Tauri v2
app with a tray icon, a self-updater, and a signed and notarized release pipeline.

## Decided (2026-09-29)

- **One app:** the Tauri app has the menu bar part built in (a tray icon with the count and its menu), and no
  Swift app remains.
- **The window loads the game from the server.**
- **macOS only** for now.

## Built (2026-09-29)

All 10 steps are in; ARCHITECTURE.md ("The desktop app") describes what exists. Findings:
- **The Keychain carries over.** A binary signed with the Developer ID under
  `dk.hanskristoffer.tokenmaxxing` read the installed app's token with no prompt. That token, though, is from
  the 0.5 backend (no `<id>.` prefix): the world backend never shipped in the Swift app. So everyone signs up
  once in the new app, as the README already says for 0.5.
- **The signed release bundle checks out:** universal, hardened runtime, the helper signed with Bun's JIT
  entitlements, and a designated requirement matching the Keychain rule.
- **Not yet proven:** notarization and `tauri-action` uploading to the release release-please made both run
  for the first time on the next release.

## Decisions

1. **One app, not two.** A single Tauri app, still called Tokenmaxxing, is both:
   - **the menu bar app**: a tray icon with today's tokens next to it ("⚡ 306M"), a menu, and the sync running
     in the background;
   - **the game**: a window you open from the tray (or the Dock, or Spotlight). Closing it keeps the tray
     running; quitting from the tray stops both.

   Tauri's tray can show text next to the icon on macOS (`TrayIcon::set_title`), so the Swift shell isn't
   needed any more. One bundle means one signing, one notarization, one updater and one Homebrew cask.
   *Alternative:* keep the Swift menu bar app and ship the Tauri game app inside it or next to it. That's two
   apps to sign, update and keep in step, for the same result.

2. **The window loads the live game from the server, not a copy inside the app.** It opens
   `https://<server>/#code=…`, just as the browser does today.
   - A game change ships with the server deploy, with no app release, and the app can never run an old game
     against a new server.
   - No CORS, CSP or server-URL plumbing, and the web code doesn't change.
   - The game needs the network anyway.

   *Alternative:* bundle `web/` into the app (`frontendDist`). That would work offline, but the game needs
   the server to do anything, and every game change would need an app update.

3. **The sync helper stays the Bun helper we have**, run by the Tauri app as a **sidecar** (`externalBin`). It
   uses the same NDJSON protocol over stdin/stdout. The log parsers and sync engine (`core/src/sync`) don't
   change; only the shell around them does, from Swift to Rust.

4. **In the Dock only while the game window is open.** Like today's menu bar app, Tokenmaxxing lives in the
   menu bar. Opening the game switches the activation policy to *Regular* (Dock icon, Cmd-Tab, menus).
   Closing the window switches back to *Accessory*.

5. **It updates itself.** The Tauri updater reads `latest.json` from this repo's GitHub releases. The repo is
   public, so we don't need Wallflower's separate releases repo. Homebrew stays as the way to install it, with
   `auto_updates true` so `brew` doesn't fight the updater.

6. **macOS only for now.** Tauri makes Windows possible later, and Wallflower shows how (NSIS build, Credential
   Manager). But our helper's log paths and Keychain use are Mac-first today.

## What the user gets

- **Install:** `brew install --cask hanskristoffer/tap/tokenmaxxing`, or the `.dmg` from the release page.
- **First launch:** the game window opens on a small "Pick a name" page that ships with the app. Once you've
  picked a name, the window loads the world.
- **Every day:** the tray shows `⚡ 306M` (tokens today). Its menu:

  | Item | What it does |
  |---|---|
  | **Open world** | Opens or focuses the game window. |
  | `306M today · #2 in town · Lv5` | Shown only (a disabled item). |
  | `🏁 Tokenmaxxing · 2nd · 18:42 left` | Only during a battle. |
  | **Sync now** | Syncs right away. |
  | **Launch at login** ✓ | A checkbox. |
  | **Check for updates…** | Checks now. |
  | **Quit Tokenmaxxing** | Stops the tray, the helper and the window. |

- **The window:**
  - It remembers its size and position.
  - Links to other sites (company websites, GitHub) open in your browser.
  - Closing the window doesn't stop the sync.

## How it works

```
Tokenmaxxing.app (Tauri v2, Rust)
├─ tray: icon + "306M" title, menu            ◄── state events from the helper
├─ main window: WebviewUrl::External(server)  ──► the game, as served today (Rivet over /api/rivet)
├─ onboarding page (local, ~1 file)           ──► invoke("sign_up", name) ─► helper
├─ Keychain (security-framework)              ─── the device token, same service/account as today
└─ sidecar: tokenmaxxing-helper (bun --compile)
     NDJSON on stdin/stdout: init · signUp · syncNow · openWorld · (new) state.today
     reads local logs, player.ingest, town.today, arcade.battle
```

### The Rust side (`app/desktop/src-tauri/`)

About the size of Wallflower's `lib.rs`, and it replaces all of `app/macos/`:

- **`helper.rs`**: starts the sidecar, restarts it if it dies, and sends and receives the NDJSON protocol.
  - It replaces `HelperProcess.swift`.
  - The message types are serde structs mirroring `core/src/protocol.ts`, and they are tested against the same
    `messages.ndjson` fixture the Swift tests decode today.
- **`keychain.rs`**: reads and writes the token under the same service (`dk.hanskristoffer.tokenmaxxing`) and
  account (`api-token`), so people stay signed in. Taken from Wallflower's `secrets.rs`.
- **`tray.rs`**: the icon (a template image, so it follows light and dark mode), the title, and the menu.
  Wallflower's `TrayIconBuilder` setup is the pattern.
- **`window.rs`**:
  - creates the game window on demand, with an external URL;
  - asks the helper for a login code (`openWorld`) and navigates to `/#code=…`;
  - switches the activation policy as the window opens and closes;
  - uses `on_navigation` to keep the window on the server's origin and send every other link to the browser.
- **Plugins:**
  - `updater` and `process` (from Wallflower);
  - `window-state` (from Wallflower);
  - `autostart` (launch at login, replacing `SMAppService`);
  - `single-instance` (a second launch focuses the first);
  - `log` (from Wallflower).

### Security

- The remote game page gets **no Tauri IPC**: no capability lists the server's URL.
- Only the bundled onboarding page can call `sign_up` and `open_world`.
- The device token stays in the Keychain and the helper. The web page only ever sees a single-use login code,
  which becomes a browser session, exactly as today.

### The helper (`app/helper/`)

- `AppState` gains `today: { tokens, rank, level } | null` and `battle: { name, place, endsAt } | null`, filled
  from `town.today()` and `arcade.battle` after each sync. We took these out when the menu bar became one
  button; the tray needs them back. The count is at most one sync old: 2 minutes, or 10 seconds in a battle.
- Nothing else changes. `helper:once`, the tests and the protocol fixture stay.

### Repo layout

```
app/desktop/                 new: the Tauri app
  src-tauri/                 Cargo.toml, tauri.conf.json, capabilities/, src/*.rs, icons/, Entitlements.plist
  onboarding/index.html      the "Pick a name" page (plain HTML + a few lines of JS)
app/helper/                  unchanged: compiled into src-tauri/binaries/tokenmaxxing-helper-<target-triple>
app/macos/                   deleted once the Tauri app ships
app/scripts/build-app.sh     replaced by `tauri build` + tauri-action
```

## Release and updates

We take Wallflower's `build-macos.yml` and `docs/release-plan.md` almost as they are:

- release-please tags `vX.Y.Z`, as today. The job then:
  1. compiles the helper for both architectures;
  2. runs `tauri-action` with `--target universal-apple-darwin`, which signs, notarizes and makes the updater
     archive and its signature;
  3. uploads the `.dmg`, `.app.tar.gz`, `.sig` and `latest.json` to **this** repo's release;
  4. renders the cask, as today.
- **Secrets:** we reuse the signing and notarization ones we have (`MACOS_CERT_P12`, `MACOS_SIGN_IDENTITY`,
  `NOTARY_*`), mapped to tauri-action's names. New: `TAURI_SIGNING_PRIVATE_KEY` and its password, from
  `bun tauri signer generate`.
  - Losing that key means installed apps can never update again, so it goes in the password manager.
- **The app** checks for updates on launch and every 4 hours (Wallflower's `update.ts`, moved to Rust), and
  shows "Update to X.Y.Z" in the tray menu.
- **The server** keeps deploying from `main` on Railway, and the game updates with it.

## Migrating from the Swift app

The goal is that people upgrade and notice nothing except the new window.

- **Same bundle id and name** (`dk.hanskristoffer.tokenmaxxing`, `Tokenmaxxing.app`): `brew upgrade` replaces the
  Swift app in place.
- **Same Keychain item.** The new app is signed by the same team with the same identifier, so macOS should let
  it read the token the Swift app wrote.
  - **This is the riskiest part of the plan.** A user who loses their token can't pick their name again (it's
    taken), so they'd lose their account.
  - Step 1 below proves it with signed builds before anything ships.
  - Fallback: one last Swift release that also copies the token to a file the Tauri app picks up once, then
    deletes.
- **Same sync state** (`~/Library/Application Support/Tokenmaxxing/state.v2.json`), so nothing is re-read or
  lost.

## Order of work (one commit each)

1. **A spike that proves the risky parts:**
   - a signed, notarized Tauri app (from CI) that reads the Keychain item the current Swift app wrote;
   - the Bun helper running as a notarized sidecar (it needs the JIT entitlements our `helper.entitlements`
     already has);
   - a tray title that updates.

   If the Keychain read fails, we build the fallback above first.
2. **The app skeleton** in `app/desktop/`: `tauri.conf.json`, the tray with a fixed title, the game window
   loading the local dev server, and `bun run desktop:dev`.
3. **The helper sidecar:** `helper.rs` with its protocol structs and the fixture test; start and restart; the
   token in the Keychain.
4. **Onboarding and Open world:** the local "Pick a name" page and `sign_up`; `openWorld` then navigate;
   links opening in the browser; Dock only while the window is open.
5. **The count:** `today` and `battle` back in the helper's state, and the tray's title and menu showing them.
6. **Launch at login, single instance, window state.**
7. **Updates:** the updater plugin, the check on launch and every 4 hours, the menu item, and the signing key.
8. **Release:** the tauri-action workflow, the cask (`auto_updates true`, dmg), and the README's install and
   development sections.
9. **Delete `app/macos/` and `build-app.sh`.** CI swaps its Swift job for `cargo clippy` + `cargo test` on
   `app/desktop/src-tauri`.
10. **Docs:** ARCHITECTURE.md (the desktop app and its release), the README.

Steps 2–6 can be dogfooded against a local server before any release. Step 8 is when users get it.

## Risks

- **The Keychain carrying over** (see above): proven in step 1.
- **Notarizing a Bun-compiled sidecar:** Tauri signs `externalBin` with the app's entitlements, so the app's
  `Entitlements.plist` has to allow JIT (as our helper's does today). Proven in step 1.
- **A remote page in a webview:** fine for our own server, but it must never get IPC. `capabilities/` lists only
  the local onboarding window, and a test checks it.
- **App size:** about 10 MB for Tauri plus about 60 MB for the Bun helper, roughly what we ship today.

## Not in this plan

- Windows and Linux builds (Tauri makes them possible; the helper would need its log paths checked).
- Notifications (a mention, an invite, a battle ending) from the tray. They're easy to add later with
  `tauri-plugin-notification`, which Wallflower already uses.
- Playing offline.
