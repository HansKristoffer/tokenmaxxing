# tokenmaxxing

A tiny pixel town for people who run AI coding agents. Install the menu bar app, pick a name, and
**Open world**: you walk around town as your own character, chat with whoever is in the same room, and
open anyone's stats. Start a **company** (or join one with a code like `K7QM-2XRP-9D`) and it gets a
house in town, painted in your brand's colours with your logo on it. When you're not playing, your
character is in that house: **at a desk** while your agents run, **asleep in bed** when they don't. Using
AI earns **coins**, and so does finishing a day in the top 3; spend them on clothes, glasses, hats and
pets that follow you around.

Reads usage from Claude Code (including subagents), Claude Cowork, Codex and Cursor.

## Install

```bash
brew install --cask hanskristoffer/tap/tokenmaxxing
```

Open **Tokenmaxxing**, pick a name, and click **Open world**. The menu bar keeps a mini leaderboard
for today; the full one is on the noticeboard in the town square (or press `L`).

**Coming from 0.4?** The world is a new backend and starts fresh: update the app, pick a name again and
recreate your company. Your usage history comes back by itself, because the app re-reads your local logs on
its first sync.

## What's shared

Only **token counts, model names, timestamps and opaque session/message ids** leave your Mac. Message
content never does. The app reads local logs:

| Source | Where |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` (subagents included) |
| Claude Cowork | `~/Library/Application Support/Claude/…/.claude/projects/**/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` |
| Cursor | `~/.cursor/projects/**/agent-transcripts`, `state.vscdb` (token counts are estimated) |

You can turn any source off in Settings. **Everything is public in the world:** anyone can see your
totals, cost, parallelism, models and daily activity, and the leaderboard ranks everyone.

**Company websites.** When a company's owner sets its website, the server asks
[Firecrawl](https://firecrawl.dev) to read that site's colours and logo, sends those to Claude to pick the
house's colours, and keeps a copy of the logo. Only the company's public website is involved; nobody's usage
data is sent anywhere for this.

## The stats

- **Tokens:** input + output + cache writes + cache reads.
- **Cost:** priced from [LiteLLM's table](https://github.com/BerriAI/litellm), refreshed daily.
- **Parallelism ×:** the average number of agents running at the same time, measured over the time you
  had at least one running. Three agents working through the same hour is 3.0×. Time is measured in
  5-minute buckets, subagents count as agents, and you need at least 1 active hour in the range to be
  ranked.
- **Peak agents:** the most agents running at once.
- **Tokens / active hour:** tokens divided by hours with at least one agent running.
- **Days** are Copenhagen days for everyone: one world, one clock.
- **Level** comes from lifetime tokens (1M → Lv1, 1B → Lv7).
- **Houses** show how hard a company's people push: tokens **per member** over the last 30 days. Under 100M
  each is a cellar hatch in a fenced yard; then a shack (100M), cottage (1B), two-storey house (5B), villa
  (15B) and a mansion with a tower (40B). A big team of light users stays in the basement.
- **Coins:** every day pays `√(tokens ÷ 1M)`: 100M tokens is 10 coins, 1B is 31. A heavy day earns more,
  but not wildly more. Finishing a day 1st, 2nd or 3rd adds 25, 15 or 10.

## How it works

```
Tokenmaxxing.app (menu bar)                        server (Railway, one process)
├─ Swift shell  ◄─ NDJSON ─►  TS helper ─────────►  Bun.serve
│  Keychain, login item       parses local logs,      ├─ /             the game (bundled at boot)
│  "Open world"               player.ingest()         ├─ /logos/:file  company logos
                                                       ├─ /api/rivet/*  proxy to the Rivet engine's gateway ◄── browser
                                                       └─ Rivet actors: town, world, player[userId]
browser: Canvas 2D world + React HUD                   engine data: $RIVETKIT_STORAGE_PATH (the volume)
```

The backend is [Rivet Actors](https://rivet.dev/docs/actors). `rivetkit` starts the Rivet engine
inside the container; `Bun.serve` exposes only its client gateway under `/api/rivet`.

| Actor | Key | What |
|---|---|---|
| `player` | user id | Raw events (SQLite), device token and browser sessions, daily rollups on ingest |
| `town` | `main` | Accounts, companies, daily rollups for everyone: leaderboards and player cards |
| `world` | `main` | Who's where: steps, rooms, rest spots (bed/desk), room chat, a 10 Hz broadcast loop |

| Path | What |
|---|---|
| `core/` | Log parsers, sync engine, shell↔helper protocol, `maps.ts` and `world.ts` (the world's rules, shared by client and server) |
| `server/` | `main.ts`, the Rivet proxy, the three actors (`src/actors/`) and what `town` does (`src/town/`), company branding, pricing |
| `web/` | The game: canvas renderer in `src/game/`, pixel art drawn in code in `src/art/`, React HUD in `src/hud/` |
| `app/helper/` | The TypeScript helper the app runs (`bun build --compile`) |
| `app/macos/` | SwiftUI `MenuBarExtra` shell (Swift Package, no Xcode project) |
| `app/scripts/build-app.sh` | Assembles, signs and notarizes `Tokenmaxxing.app` |
| `packaging/tokenmaxxing.rb` | Homebrew cask template |
| `ARCHITECTURE.md` | How it all fits together: serving, auth, the actors, houses, coins |

All art is drawn in code (palette-string sprites and rectangles), so the repo carries no image assets.

## Development

Requires Bun 1.4+ and Xcode 16+ (macOS 14+).

```bash
bun install --ignore-scripts
bun run dev                            # http://localhost:8787 (data in ./.data/rivet); restart to see web edits
bun run dev:seed                       # a few people, two companies, and a link that signs you in
bun run app:dev                        # builds the app against localhost and opens it
bun run check                          # typecheck + lint + tests (tests start their own server)
swift test --package-path app/macos    # Swift protocol contract test
```

In `app:dev` builds the helper runs from source, so TypeScript changes only need an app restart.
To sync without the UI:

```bash
TOKENMAXXING_TOKEN=… TOKENMAXXING_SERVER_URL=http://localhost:8787 bun run helper:once
```

### Server config

| Var | Default | |
|---|---|---|
| `PORT` | `8787` | |
| `RIVETKIT_STORAGE_PATH` | `~/.rivetkit` in dev | Where the engine keeps every actor. Required in production: `/data/rivet` on the Railway volume (set in the Dockerfile) |
| `RIVET_LOG_LEVEL` | | `error` keeps the engine quiet |
| `NODE_ENV` | | `production` minifies the game |
| `FIRECRAWL_API_KEY` | | Reads company websites. Without it, a website only goes on the sign |
| `ANTHROPIC_API_KEY` | | Turns a website's brand into house colours. Without it, the site's own colours are used |

`RIVETKIT_STORAGE_PATH` and `RIVET_LOG_LEVEL` are read by RivetKit's native side, so they must be set in
the environment before the process starts.

### Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (PR titles are checked).
[release-please](https://github.com/googleapis/release-please) keeps a Release PR open. Merging it
tags the version, builds and notarizes the app for arm64 and x86_64, attaches the zips, and updates the
cask in `HansKristoffer/homebrew-tap`. Railway deploys the server from `main`.

Required repo settings: the variable `TOKENMAXXING_SERVER_URL`, and the secrets `MACOS_CERT_P12`,
`MACOS_CERT_PASSWORD`, `MACOS_SIGN_IDENTITY`, `NOTARY_APPLE_ID`, `NOTARY_TEAM_ID`,
`NOTARY_PASSWORD` and `HOMEBREW_TAP_DEPLOY_KEY` (a write deploy key on the tap repo).

## License

MIT. Based on [anaralabs/tokenleader](https://github.com/anaralabs/tokenleader).
