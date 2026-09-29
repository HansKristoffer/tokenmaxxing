# Architecture

tokenmaxxing is a small pixel-art town for people who run AI coding agents. The desktop app syncs your token
usage from the menu bar and shows the town in its window. Everyone is in **one world**. You work for at most one **company**, which has a house in
town; when you're not playing, your character sleeps in its bed, or sits at its desk while your agents run.

```
Tokenmaxxing.app (Tauri v2, app/desktop)             server (one Railway service)
├─ menu bar: ⚡ tokens today, menu                   Bun.serve (server/src/main.ts)
├─ sidecar: TS helper ◄─ NDJSON ─► Rust ───────────►  ├─ /               the game (web/, bundled at boot)
│    parses logs, player.ingest()                     ├─ /logos/:file    company logos (sandboxed)
├─ game window: Canvas 2D world + React HUD           ├─ /health
│    (the live page, over WebSocket) ◄─────────────►  └─ /api/rivet/*    proxy to the Rivet engine (gateway only)
└─ Keychain, login item, updater                      Rivet engine on 127.0.0.1, actors in this process,
                                                      storage on the /data volume
```

The game also runs in any browser; the app's window is that same page.

| Path | What |
|---|---|
| `core/` | Log parsers and sync, the shell↔helper protocol, `world.ts` (shared rules), `maps.ts` (the maps), `shop.ts` (coins and items), `games/` (every game's rules), `format.ts`, `range.ts` |
| `server/src/actors/` | The actors (`player`, `town`, `world`, `arcade`, `match`), `registry.ts`, `shared.ts` (auth and SQL helpers) |
| `server/src/town/` | What `town` does, as plain functions: `users`, `companies`, `boards` (leaderboards, profiles, the HUD's corner), `games` (game stats), `coins`, `sync` (pushes to `world`) |
| `server/src/` | `main.ts`, `proxy.ts`, `brand.ts` (websites → house colours and logos), `pricing.ts`, `stats.ts`, `validate.ts` |
| `web/src/` | `game/` (canvas loop, input, camera, houses, labels, pets), `art/` (every sprite, drawn in code), `hud/` (React panels) |
| `app/helper/` | The sync helper: log parsing and `player.ingest`, run by the app as a sidecar |
| `app/desktop/` | The desktop app (Tauri v2): the menu bar, the game window, onboarding, updates |

## Serving

- `main.ts` bundles the game with `Bun.build`, *then* starts the registry. Once RivetKit's native runtime is
  up, Bun's HTML bundler fails in the same process, so there's no hot reload: restart `bun run dev`.
- `registry.start()` runs the Rivet engine on `127.0.0.1`. `proxy.ts` forwards only the client gateway
  (`/api/rivet/gateway/*` and `/metadata`, HTTP and WebSocket); the engine's admin API is never exposed.
- `RIVETKIT_STORAGE_PATH` and `RIVET_LOG_LEVEL` must be real environment variables: RivetKit's native side
  ignores `process.env` changes made at runtime. The Dockerfile and `bun run dev` set them.
- Company logos live next to the Rivet data (`/data/logos` in Docker, `.data/logos` in dev).
- A sync batch is about 300 KB, so `maxIncomingMessageSize` is 1 MB. Shutdown grace is 5 s.

## Auth

- Tokens are `<userId>.<secret>`; the `player` actor stores `sha256(secret)`. Other actors check a token by
  asking that player (`authenticate` in `shared.ts`, cached for a minute) and trust only the caller they get.
- Actors call each other with an in-process `INTERNAL_KEY`.
- **Open world:** the helper mints a one-time login code (2 minutes) and opens `/#code=…`. The page redeems it
  for a 30-day browser session and removes the code from the URL. The fragment never reaches server logs, and
  the device token never goes into a URL.
- The app forgets its token when the server rejects it and goes back to picking a name.
- There's no web sign-up: without a session the page says to open the world from the menu bar app.

## The desktop app

`app/desktop/src-tauri/src/`, in Rust:

- **`helper.rs`** runs the helper sidecar (Bun-compiled) and speaks the NDJSON protocol in
  `core/src/protocol.ts`: `init`, `signUp`, `syncNow` and `openWorld`, and `state` and `token` events. It
  restarts the helper with backoff. A fixture written by `app/helper/test/protocol.test.ts` keeps the Rust
  types and the TypeScript ones in step.
- **`tray.rs`**: the menu bar. The bolt is a template image with today's tokens as its title. Its menu:
  - Open world;
  - your rank and level, and the battle you're in;
  - Sync now;
  - Launch at login;
  - updates;
  - Quit.

  It's rebuilt from the helper's state after every sync: every 2 minutes, or every 10 seconds during a battle.
- **`world.rs`**: the windows.
  - The game window loads the live page (`/#code=…`, the same single-use login code as a browser). It stays
    on the server's origin; other links open in the browser.
  - The "pick a name" page (`app/desktop/onboarding/`) is the only local page, and the only one with IPC
    (`capabilities/default.json`). The game page has none.
  - The app is in the Dock only while a window is open (`LSUIElement`, then the activation policy).
- **`keychain.rs`**: the device token, in the login Keychain as `dk.hanskristoffer.tokenmaxxing` /
  `api-token`. Dev builds use `….dev` and their own state dir.
- **`updates.rs`**: Tauri's updater. It checks `latest.json` on this repo's latest release on launch and every
  4 hours, and installs from the menu. Downloads must be signed with the key in `TAURI_SIGNING_PRIVATE_KEY`.
- **Plugins:** single-instance (a second launch opens the world), window-state, autostart (a LaunchAgent) and
  log.
- **The server URL** is baked in at build time (`TOKENMAXXING_SERVER_URL`). A release build refuses to build
  without it; a dev build uses `localhost:8787`.

## Actors

**`player[userId]`**: raw events (SQLite, deduplicated), tokens, sessions and login codes. `ingest` stores a
batch, recomputes the touched world days (per-model sums, prompts, PRs, 5-minute agent buckets) and sends them
to `town.report`, then tells `world` how many agents are live, and `arcade.usage` in case they're in a battle.

**`town["main"]`**: everything cold, joined in SQL.
- Tables: `users`, `companies` (ids never reused), `usage_daily`, `activity_daily`, `purchases`, `ledger`
  (coins held and paid by games), `match_players` (one row per player per finished game).
- Accounts: `signUp` (200 an hour, globally), `rename`, `setLook` (refuses shop items you don't own), `me`.
- Companies: create (takes the first free plot of 8), leave, kick, rename, `setWebsite`. One company per
  person, at most 50 members. The earliest joiner takes over from a leaving owner; the last one out closes the
  company.
- Joining: `listings` shows every company; `apply` asks to join one (one pending application per person,
  applying elsewhere replaces it); the owner will `approve` or `decline`, and `withdraw` takes it back. The
  owner hears about an application, and the applicant about the answer, through `world.notify` (a `notice`
  event, shown as a toast). A new player's first visit opens this choice.
- Stats: `leaderboard`, `profile`, `today` (the HUD's corner), `searchNames`, `gameBoard`. Cost is priced
  when read.
- Coins: `wallet`, `buy`; for `arcade`: `hold`, `pay`, `refund`, `recordMatch`. Games: `gameBoard`.
- Every change a player could see is pushed to `world` (`town/sync.ts`); `world` never asks `town`.

**`world["main"]`**: everything live, in actor state, with chat in SQLite (last 200 lines per room).
- A 10 Hz tick sends each room its `moves`, and head counts (`occupancy`) and who's inside each house
  (`houses`, for town) when they change.
- Actions: `join`, `step` (one adjacent walkable tile, no faster than running; doors change room), `sit`,
  `say` (20 a minute; `@name` sends `mention` to someone in another room), `back` (after a game).
- Events: `snapshot` (on joining or changing room), `moves`, `info`, `companies`, `occupancy`, `houses`, `notice`,
  `chat`, `mention`.
- **Resting.** Closing the last tab, or 3 minutes without input, sends you to your bed; offline with agents
  active in the last 10 minutes, to your desk. Company members rest in their house, others at the Inn. Your spot
  is remembered: the next `join`, or the first step after being away, puts you back there.

**`arcade["main"]`** and **`match[id]`**: the mini games; see *Games*.

## Companies and houses

- A house's size follows its 30-day tokens **per member** (`houseTier`): basement, shack from 100M, cottage
  1B, house 5B, villa 15B, mansion 40B.
- **Websites** (`brand.ts`). The owner sets one; it goes on the sign at once. If `FIRECRAWL_API_KEY` is set,
  Firecrawl's `branding` format reads the site's colours and logo. Claude (`claude-opus-5-5`, low effort,
  structured output) turns them into roof, wall, trim and plaque colours; without `ANTHROPIC_API_KEY` the site's
  own colours are used. The logo is downloaded from public hosts only (no private or loopback addresses, a few
  redirects, images up to 512 KB), and served from `/logos/` with a sandboxing CSP.

## Coins and the shop

- Each world day pays `√(tokens ÷ 1M)` coins (1.5B ≈ 38, 600M ≈ 24, 100M = 10). Finishing a day 1st, 2nd or 3rd
  adds 25, 15 or 10.
- Balances aren't stored: they're worked out from `usage_daily` minus `purchases`, so a late sync still pays.
- The catalogue (`core/src/shop.ts`): 4 outfits, 3 glasses, 3 hats and 4 pets, 60 to 1,500 coins. Items are
  worn through `Look` (`outfit` ≥ 8, `glasses`, `hat`, `pet`). Pets follow their owner in the client.

## Games

**Decided:** stakes only (every coin a winner gets came from the other players; no house prize and no town
cut). A stake is at most 500 and half your balance, a side bet at most 200, one game at a time. Every game
gathers in the town square so anyone can watch, and you play in a panel over the world.

**The games:**
- **Ship, Pivot, Raise** (1v1): rock-paper-scissors for founders, best of 5, 15 seconds a pick.
- **Hype Cycle** (2–8): the valuation climbs as e^(t/12) until it crashes; cash out in time. Three rounds.
  Each round's crash point comes from a seed whose SHA-256 is shown before it and the seed after.
- **Due Diligence** (2–6): Liar's Dice with 🦄 wild, 30 seconds a turn; the last with dice wins.
- **Tokenmaxxing** (2–12): the most real tokens in 15 minutes to 24 hours, starting on the minute after a
  minute's countdown, with 3 minutes of grace for late syncs.

- **Rules are pure** (`core/src/games/`): each game is a `GameDef` over plain JSON state: `setup`, `move`,
  `tick`, `forfeit`, a per-viewer `view` (hiding what a player mustn't see yet), `outcome` (places, or void),
  plus optional `callouts`, `status`, `board`, `headline` and `endsAt` for the world. Usage games add
  `usageWindow` and `usage`. `GAMES` lists them: Ship, Pivot, Raise; Hype Cycle; Due Diligence; Tokenmaxxing.
- **`arcade["main"]`** is the social side and the money. Everything starts as a table: `open` (invite people,
  open it to anyone, or both), `invite`, `answer` (yes, no or a counter offer), `join`, `leave`, `start`. A
  full table starts a match. It also takes side bets, runs double or nothing, and `settle`s: the pot is paid by
  place (`core/src/games/payouts.ts`, integer math), side bets are a parimutuel pool, and a void game refunds
  everything. Each connection gets its own `lobby` event.
- **`match[id]`** runs one game: its tick loop, frames per viewer (`frame` events), forfeits after 20 seconds
  away for games that hold their players, and a 20-minute safety net. It tells `world` the live status and
  `arcade` the outcome.
- **Coins** move only through the `ledger` in `town`: `hold` is all or nothing (a stake is at most 500 and half
  your balance), `pay` never pays out more than a ref holds, and `refund` returns what's left. Every ref sums to
  zero when it's settled; there's no house cut and no house prize.
- **In the world** (`world.gather`/`release`): players walk to a table in the town square and stand there as
  `playing` until it ends; `back` returns them to where they were. Tokenmaxxing gets an **arena** instead: its
  players stay free, and it's their rest spot until the battle ends. Banners, signs over open tables and the
  arena's scoreboard are drawn in `web/src/game/games.ts`.
- **Tokenmaxxing** pulls, it doesn't add up: after each sync, the match asks `player.tokensBetween(start, end)`
  (each minute capped at 50M and flagged), so re-sent or late events can't double count. After each sync the
  app asks `arcade.battle` (which pulls its score too) and syncs every 10 seconds until the battle is over.
- **When something fails:** a match retries reporting its outcome, settling can run again without paying
  twice, the arcade calls off a match stuck past a limit (refunding everyone) and retries letting its players
  go, and it destroys match actors a minute after they end.

### Adding a game

1. Write `core/src/games/<id>.ts` exporting a `GameDef`, add its id to `GameId` and it to `GAMES`.
2. Write `web/src/games/<id>.tsx` (it gets `{ view, info, you, now, move }`), add it to `COMPONENTS`, and
   optionally give it a table in `web/src/art/tables.ts`.
3. Write `core/test/games/<id>.test.ts`; `registry.test.ts` already checks every game's basics.

No server changes, actions or tables are needed.

### Later

- A physical arcade in the town square (machines that open the lobby, a trophy shelf of today's winners).
- Inviting a whole company at once; company tournaments built from tables.
- Easing Tokenmaxxing's counters between updates, and "✓ syncing" next to seated players.
- More games: Term Sheet (Split or Steal; needs a rule for when both steal), Runway (Farkle), Burn Rate
  (blackjack), Unicorn (highest unique number), a coin flip at the fountain, Prompt Race (typing), and
  fighting "Rate Limit" in the tall grass.

## The client

- Plain Canvas 2D with `imageSmoothingEnabled = false`, integer zoom, and grid movement: your own steps are
  predicted and corrected by the server; other players replay a short step queue.
- Every sprite is a palette-string grid baked into a canvas at runtime (`web/src/art/`), so there are no image
  assets.
- Chat has quick replies above it: emoji and startup one-liners, sent with one click. A line made only of
  emoji (up to 8) bursts around its author instead of showing a bubble (`game/emoji.ts`).
- React draws only the HUD and reads a small `useSyncExternalStore` store (`store.ts`). Game state never passes
  through React.

## One clock

"Today" is `Europe/Copenhagen` for everyone (`core/src/range.ts`).

## Known limits

These are deliberate, and marked `ponytail:` in the code:
- one `world` actor for everyone (split it per room when hundreds are online at once; the protocol is already
  per room);
- the sign-up limit is global and in memory (actors never see client IPs);
- leaderboards and wallets are recomputed on every request;
- a late sync can knock someone off a past podium after they spent the bonus;
- the logo download checks DNS before fetching, so DNS rebinding in between isn't caught.

## Tests

`bun run check` runs typecheck, lint and every test. Actor tests start a real server in a subprocess, with its
own engine, port and data directory (`server/test/rivet.ts`), so they use the production code paths. Map, step,
rest-spot and coin rules are pure and tested in `core/test/`.
