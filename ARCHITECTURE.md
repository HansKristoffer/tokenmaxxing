# Architecture

tokenmaxxing is a small pixel-art town for people who run AI coding agents. The menu bar app syncs your token
usage; the town shows it. Everyone is in **one world**. You work for at most one **company**, which has a house in
town; when you're not playing, your character sleeps in its bed, or sits at its desk while your agents run.

```
Tokenmaxxing.app (menu bar)                          server (one Railway service)
├─ Swift shell  ◄─ NDJSON ─►  TS helper ───────────►  Bun.serve (server/src/main.ts)
│  Keychain, login item       parses logs,              ├─ /               the game (web/, bundled at boot)
│  "Open world"               player.ingest()           ├─ /logos/:file    company logos (sandboxed)
│                                                       ├─ /health
browser: Canvas 2D world + React HUD  ◄─ WebSocket ──►  └─ /api/rivet/*    proxy to the Rivet engine (gateway only)
                                                        Rivet engine on 127.0.0.1, actors in this process,
                                                        storage on the /data volume
```

| Path | What |
|---|---|
| `core/` | Log parsers and sync, the shell↔helper protocol, `world.ts` (shared rules), `maps.ts` (the maps), `shop.ts` (coins and items), `format.ts`, `range.ts` |
| `server/src/actors/` | The three actors (`player`, `town`, `world`), `registry.ts`, `shared.ts` (auth and SQL helpers) |
| `server/src/town/` | What `town` does, as plain functions: `users`, `companies`, `boards` (leaderboards, profiles, menu bar), `coins`, `sync` (pushes to `world`) |
| `server/src/` | `main.ts`, `proxy.ts`, `brand.ts` (websites → house colours and logos), `pricing.ts`, `stats.ts`, `validate.ts` |
| `web/src/` | `game/` (canvas loop, input, camera, houses, labels, pets), `art/` (every sprite, drawn in code), `hud/` (React panels) |
| `app/helper/`, `app/macos/` | The menu bar app: sync, onboarding, mini leaderboard, **Open world** |

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
- Sign-out revokes the device token and every browser session, and closes open game tabs.
- There's no web sign-up: without a session the page says to open the world from the menu bar app.

## Actors

**`player[userId]`**: raw events (SQLite, deduplicated), tokens, sessions and login codes. `ingest` stores a
batch, recomputes the touched world days (per-model sums, prompts, PRs, 5-minute agent buckets) and sends them
to `town.report`, then tells `world` how many agents are live.

**`town["main"]`**: everything cold, joined in SQL.
- Tables: `users`, `companies` (ids never reused), `usage_daily`, `activity_daily`, `purchases`.
- Accounts: `signUp` (200 an hour, globally), `rename`, `setLook` (refuses shop items you don't own), `me`.
- Companies: create (takes the first free plot of 8), join by code, leave, kick, rename, rotate the code,
  `setWebsite`. One company per person, at most 50 members. The earliest joiner takes over from a leaving owner;
  the last one out closes the company.
- Stats: `leaderboard`, `profile`, `menuBar`, `searchNames`. Cost is priced when read.
- Coins: `wallet`, `buy`.
- Every change a player could see is pushed to `world` (`town/sync.ts`); `world` never asks `town`.

**`world["main"]`**: everything live, in actor state, with chat in SQLite (last 200 lines per room).
- A 10 Hz tick sends each room its `moves`, and head counts (`occupancy`) and who's inside each house
  (`houses`, for town) when they change.
- Actions: `join`, `step` (one adjacent walkable tile, no faster than running; doors change room), `sit`,
  `say` (20 a minute; `@name` sends `mention` to someone in another room), `history`.
- Events: `snapshot` (on joining or changing room), `moves`, `info`, `companies`, `occupancy`, `houses`,
  `chat`, `mention`.
- **Resting.** Closing the last tab, or 3 minutes without input, sends you to your bed; offline with agents
  active in the last 10 minutes, to your desk. Company members rest in their house, others at the Inn. Your spot
  is remembered: the next `join`, or the first step after being away, puts you back there.

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
