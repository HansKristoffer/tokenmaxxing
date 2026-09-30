# Plan: linking a second computer

Many people run their agents on a second computer too: a Mac mini under the desk, a Linux box, a VM. Its
tokens should count for the same player. This plan adds a small command-line tool you install on that
computer and link to your account with a code from the app on your main Mac.

## Decided (2026-09-30)

- **Only the desktop app makes link codes**, not a browser session. A stolen 30-day session must not become
  a token that never expires.
- **macOS and Linux** from the start. Workhorses are often Linux boxes, and Bun compiles for both. Native
  Windows later (WSL already works as Linux).
- **Totals only.** Tokens per computer can come later.

## Built (2026-09-30)

All six steps are in; ARCHITECTURE.md ("Linked computers") describes what exists. Findings:
- **No server URL is baked into the CLI.** The server serves `/install.sh` with its own origin in it, and
  the CLI keeps it in its config. `--server` (or `TOKENMAXXING_SERVER_URL`) works when running it by hand.
- **No Developer ID signing for the CLI.** Bun signs the Mac binaries ad hoc when it compiles them on a Mac,
  which Apple Silicon requires, and curl doesn't quarantine downloads, so Gatekeeper never asks. That also
  means no hardened runtime, so no JIT entitlements to carry.
- **Proven on Linux** in a Debian container (arm64): `curl … | sh -s -- link`, the first sync, `status`, and
  the fallback when there's no systemd (it prints a `nohup` line).
- **Revoking is at most a sync late.** New usage goes to `player`, which checks the token itself; other
  actors cache it for a minute, so an idle computer notices within about three minutes.
- **Old players move over by themselves**: `onWake` turns the old token list into devices. Checked against
  data written by the previous server.
- **Not yet proven:** a real systemd user service (only its unit file is tested); the app's side in a running
  app (the menu item and the game's "Link a computer" button: compiled, and the helper command tested, but
  not clicked); and the release job, which runs for the first time on the next release.

## What's already there

- A player already keeps a list of device token hashes, so a second computer is one more entry.
- Every stat comes from the player's own events: `player.report()` recomputes the touched days from all of
  them. So totals, cost, coins, podiums, parallelism, peak agents, sitting at the desk and Tokenmaxxing
  battles (`tokensBetween`) all include a linked computer with no other change.
- Re-sent events are dropped (`events_dedup`), and message ids are unique across machines (Claude's message
  ids, Codex's `<session uuid>:<time>:<n>`, Cursor's bubble ids). Two computers seeing the same logs (a synced
  `~/.claude`) or reporting the same PR count it once.
- `helper:once` already syncs without the app.

## What the user gets

1. On the main Mac: **Link a computer…** in the menu bar, or on your own card in the game. It copies a
   command, good for 10 minutes and once:

   ```
   curl -fsSL https://<server>/install.sh | sh -s -- link 42.Xk3…
   ```

2. On the workhorse, that downloads `tokenmaxxing` for its OS and chip into `~/.local/bin`, links it,
   installs a background service and backfills the history:
   `Linked to @hans as "mac-studio". Syncing every 2 minutes.`
3. Afterwards: `tokenmaxxing status`, `sync`, `logs` and `unlink`. The game lists your computers, when each
   last synced, and revokes them.

## How it works

### The server (`player`)

- `tokens: string[]` becomes `devices`: `{ id, hash, kind: "app" | "linked", name, platform, createdAt,
  lastSeenAt }`. Old state is converted in `onWake`.
- `mintLinkCode()`, from the app's token only: `<userId>.<secret>`, single use, 10 minutes.
- `redeemLinkCode(code, name, platform)`, anonymous like `redeemLoginCode`: a new `linked` device token. At
  most 10 devices.
- `devices()` and `revokeDevice(id)` for the player; a linked computer may revoke only itself (`unlink`).
  The app's own device can't be revoked: losing it loses the account.
- **A linked token only syncs.** Its caller is `via: "linked"`: it can `ingest`, and read `town.today` and
  `arcade.battle` (`requireSyncer`). Everything else uses `requireUser`, which refuses it. So a token left on
  a shared box can't chat, spend coins or open the world.
- Revoking stops syncing at once; other actors' token cache may accept it for up to a minute more.

### The tool (`app/helper`, built as a CLI)

- A second entry next to `main.ts`, reusing `Helper` and `core/sync`: `link <code>`, `run` (the service:
  sync every 2 minutes, every 10 seconds in a battle), `sync`, `status`, `unlink`.
- Files in `~/Library/Application Support/Tokenmaxxing CLI/` or `$XDG_CONFIG_HOME/tokenmaxxing/`; the token
  in a file only you can read (a headless box has no keyring).
- The service: a LaunchAgent on macOS; a `systemd --user` unit on Linux, with `loginctl enable-linger` so it
  runs while nobody is logged in.
- A revoked token deletes itself and exits with a code the service doesn't restart on.
- Log paths on Linux: Claude Code and Codex already work; Cursor's state is under `~/.config/Cursor`; Cowork
  is Mac only.
- It refuses to link on a Mac where the app is signed in: one syncer per computer.

### Release

- The release job also builds `tokenmaxxing-{darwin,linux}-{arm64,x64}` and `SHA256SUMS`, and uploads them to
  the same release. Built on a Mac, so Bun signs the Mac ones (ad hoc).
- The server serves `/install.sh`, with its own origin in it: it picks the binary, checks its checksum,
  installs it and runs it with its arguments.

### The app and the game

- The helper gets `linkCode`, the menu **Link a computer…** (copies the command), and Tauri a
  `link_computer` command the game may call, like `enter_world`.
- The game: a Computers section on your own card, with a "Link a computer" button (in a plain browser it
  says to open the world from the app).

## Order of work

1. **The server:** devices, `linked` callers, link codes, listing and revoking.
2. **The CLI:** its commands, paths per platform, launchd and systemd.
3. **Release:** the four binaries, checksums and `/install.sh`.
4. **The app:** `linkCode`, the menu item and `link_computer`.
5. **The game:** the Computers section.
6. **Docs:** README ("On a second computer") and ARCHITECTURE's Auth.

## Later

- Tokens per computer (a `device_id` on each event; the first computer to send an event gets it).
- The CLI updating itself.
- Linking a Mac that has the full app, from its "Pick a name" page.
- Native Windows.
