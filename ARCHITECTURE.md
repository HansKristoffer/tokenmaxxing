# Architecture

tokenmaxxing is a small pixel-art town for people who run AI coding agents. The desktop app syncs your token
usage from the menu bar and shows the town in its window. Everyone is in **one world**. You work for at most one **company**, which has a house in
town; when you're not playing, your character sleeps in its bed, or sits at its desk while your agents run.

```
Tokenmaxxing.app (Tauri v2, app/desktop)             server (one Railway service)
├─ menu bar: ⚡ tokens today, menu                   Bun.serve (server/src/main.ts)
├─ sidecar: TS helper ◄─ NDJSON ─► Rust ───────────►  ├─ /               the marketing site (site/, Astro, built in the image)
│    parses logs, player.ingest()                     ├─ /play           the game (web/, bundled at boot)
│                                                     ├─ /admin          the admin page (web/admin.html)
│                                                     ├─ /logos/:file    company logos (sandboxed)
├─ game window: Canvas 2D world + React HUD           ├─ /health
│    (the live page, over WebSocket) ◄─────────────►  └─ /api/rivet/*    proxy to the Rivet engine (gateway only)
└─ Keychain, login item, updater                      Rivet engine on 127.0.0.1, actors in this process,
                                                      storage on the /data volume
```

The game also runs in any browser; the app's window is that same page, at `/play`.

| Path | What |
|---|---|
| `core/` | Log parsers and sync, the shell↔helper protocol, `world.ts` (shared rules), `maps.ts` (the maps), `shop.ts` (coins and items), `office.ts` (offices and furniture), `games/` (every game's rules), `format.ts`, `range.ts`, `sky.ts` (sun, moon and weather maths for Copenhagen) |
| `server/src/actors/` | The actors (`player`, `town`, `world`, `arcade`, `match`), `registry.ts`, `shared.ts` (auth and SQL helpers) |
| `server/src/town/` | What `town` does, as plain functions: `users`, `companies`, `boards` (leaderboards, profiles, the HUD's corner), `games` (game stats), `coins`, `sync` (pushes to `world`) |
| `server/src/` | `main.ts`, `proxy.ts`, `headers.ts` (CSP and friends), `brand.ts` (websites → house colours and logos), `pricing.ts`, `stats.ts`, `validate.ts`, `weather.ts` (one Open-Meteo fetch per 15 min, for the `world` actor) |
| `web/src/` | `game/` (canvas loop, input, camera, houses, labels, pets), `art/` (every sprite, drawn in code), `hud/` (React panels) |
| `app/helper/` | The sync helper: log parsing and `player.ingest`, run by the app as a sidecar |
| `app/desktop/` | The desktop app (Tauri v2): the menu bar, the game window, updates |
| `site/` | The marketing site at `/` (Astro, static): `bun run site:dev` to work on it, `bun run site:build` before serving it |

## Serving

- `main.ts` bundles the game with `Bun.build`, *then* starts the registry. Once RivetKit's native runtime is
  up, Bun's HTML bundler fails in the same process, so there's no hot reload: restart `bun run dev`.
- `registry.start()` runs the Rivet engine on `127.0.0.1`. `proxy.ts` forwards only the client gateway
  (`/api/rivet/gateway/*` and `/metadata`, HTTP and WebSocket); the engine's admin API is never exposed.
- The gateway would let a browser create any actor, with any key and input. `gatewayAllowed` lets through
  only existing actors (by id, or `get` by key) and `getOrCreate(["main"])` of `town`, `world` and `arcade`,
  with no input. The actors check too: `player` and `match` refuse to be created without `INTERNAL_KEY` in
  their input (`fromInside`), and the singletons refuse any key but `main` (`requireMain`). Otherwise
  anyone could make `player[<the next id>]` with their own token and own the next account.
- Per client IP, the proxy allows 1,200 gateway requests and 300 new WebSockets a minute
  (`GATEWAY_REQUESTS_PER_MIN`, `GATEWAY_SOCKETS_PER_MIN`). The IP is `CLIENT_IP_HEADER` (`x-real-ip`, set by
  Railway's edge) or the socket's; the proxy passes it on to actors as `x-tokenmaxxing-ip`, replacing any
  the client sent.
- `/play` and `/admin` send a CSP (`headers.ts`): our own scripts only, connections only back to us (and the
  desktop app's IPC for the game), no framing. The page files aren't served at their own paths.
- `RIVET__GUARD__TCP_NODELAY=true` turns off Nagle on the engine's sockets. Actors and the engine talk over
  loopback, and without it each actor call waits ~40 ms on a delayed ACK. The runner's end of that connection
  has no such switch yet (rivetkit 2.3.21), so a call still pays some of it.
- `RIVETKIT_STORAGE_PATH`, `RIVET_LOG_LEVEL` and `RIVET__GUARD__TCP_NODELAY` must be real environment
  variables: RivetKit's native side ignores `process.env` changes made at runtime. The Dockerfile and `bun run dev` set them.
- Company logos live next to the Rivet data (`/data/logos` in Docker, `.data/logos` in dev).
- A sync batch is about 300 KB, so `maxIncomingMessageSize` is 1 MB. Shutdown grace is 5 s.

## Auth

- Tokens are `<userId>.<secret>`; the `player` actor stores `sha256(secret)`. Other actors check a token by
  asking that player (`authenticate` in `shared.ts`, cached for a minute) and trust only the caller they get.
- Actors call each other with an in-process `INTERNAL_KEY`.
- **Open world:** the app's window loads `/play`. With no session, the page asks the app (`enter_world`), whose
  helper mints a one-time login code (2 minutes); the page redeems it for a 30-day session. With no account
  yet, the page asks for a name first and the app signs up. The device token never leaves the app.
- A browser can still be signed in with `/#code=…`: the page redeems the code and removes it from the URL.
- The app forgets its token when the server rejects it and goes back to picking a name.
- There's no web sign-up: in a browser, without a session the page says to open the world from the app.
- **Linked computers** (a second machine running agents; see below). The app mints a link code
  (`mintLinkCode`, 10 minutes, single use); the other computer trades it for its own token
  (`redeemLinkCode`). That token only syncs: it can `ingest` and read `town.today` and `arcade.battle`
  (`requireSyncer`), and `requireUser` refuses it everywhere else. The player lists them (`devices`) and
  removes them (`revokeDevice`); a computer can remove only itself, and nobody can remove the app's own.
- **Admin:** `/admin#token=…` keeps the token in `localStorage`, drops it from the URL, and connects to `town`
  with `{ admin: token }`. A fragment never reaches the server, so the token stays out of logs (`?token=`
  works too, but does reach it). `authenticate` checks it against `ADMIN_TOKEN` (constant time; unset lets
  nobody in, and under 32 characters fails the boot). Only `town`'s `admin*` actions accept that caller.
- Login codes, link codes and sessions are capped per player (5 live codes of each kind, 20 sessions; the
  oldest go first).

## The desktop app

`app/desktop/src-tauri/src/`, in Rust:

- **`helper.rs`** runs the helper sidecar (Bun-compiled) and speaks the NDJSON protocol in
  `core/src/protocol.ts`: `init`, `signUp`, `syncNow`, `openWorld` (a login code) and `linkComputer` (a link
  code and the line that uses it), and `state` and `token` events. It
  restarts the helper with backoff. A fixture written by `app/helper/test/protocol.test.ts` keeps the Rust
  types and the TypeScript ones in step.
- **`tray.rs`**: the menu bar. The bolt is a template image with today's tokens as its title. Its menu:
  - Open world;
  - your rank and level, today's tokens per source (Claude Code, Codex, …, as the server has them), and the
    battle you're in;
  - Sync now;
  - Link a computer… (copies the line to run on the other computer);
  - Launch at login;
  - updates;
  - Quit.

  It's rebuilt from the helper's state after every sync: every 2 minutes, or every 10 seconds during a battle.
- **`world.rs`**: the game window, the app's only window.
  - It loads the live page (`/play`) once the helper knows whether there's an account, and opens by itself
    when there isn't one. It stays on the server's origin; other links open in the browser.
  - The page, from the server's origin only, may sign itself in (`enter_world`: a login code, after signing
    up if it's given a name), ask about app updates and start one (`update_status`, `install_update` and
    their `app-update` event), and get the line that links another computer (`link_computer`). The capability is added in `lib.rs`, since it names the server. App commands
    are otherwise denied (`build.rs`).
  - The app is in the Dock only while the window is open (`LSUIElement`, then the activation policy).
- **`keychain.rs`**: the device token, in the login Keychain as `dk.hanskristoffer.tokenmaxxing` /
  `api-token`. Dev builds use `….dev` and their own state dir.
- **`updates.rs`**: Tauri's updater. It checks `latest.json` on this repo's latest release on launch and every
  hour. With no window open, a new version installs right away and the app restarts. While the game is open,
  it waits: the game shows an "Update" button (`web/src/hud/AppUpdate.tsx`) and the menu an "Update to…"
  item, and it installs when either is clicked or the window closes. After an update started with the game
  open, the game opens again. Downloads must be signed with the key in `TAURI_SIGNING_PRIVATE_KEY`, and the
  release job checks the published one against the app's public key before anyone installs it.
- **Plugins:** single-instance (a second launch opens the world), window-state, autostart (a LaunchAgent) and
  log.
- **The server URL** is baked in at build time (`TOKENMAXXING_SERVER_URL`). A release build refuses to build
  without it; a dev build uses `localhost:8787`.

## Linked computers

A second computer running agents syncs into the same player.

- **The CLI** (`app/helper/src/cli.ts`) wraps the same `Helper` as the app: `link`, `run`, `sync`, `status`,
  `logs`, `unlink`. Its token and read positions are in `~/Library/Application Support/Tokenmaxxing CLI/` or
  `$XDG_CONFIG_HOME/tokenmaxxing/` (`TOKENMAXXING_CLI_DIR` for tests), the token readable only by its user.
  It won't link on a Mac where the app syncs already.
- **The service** (`service.ts`): a LaunchAgent, or a `systemd --user` unit with lingering on, so it runs
  while nobody's logged in. Both carry the `PATH` and log-location variables from when it was linked, and
  restart it only when it fails: once its token is revoked, it removes itself and exits cleanly.
- **Installing** (`server/src/install.sh`, served at `/install.sh` with the server's own origin filled in):
  picks the binary for the OS and CPU, checks it against `SHA256SUMS` from the latest release, and runs it
  with its arguments. The binaries are `bun build --compile` output (`app/helper/scripts/cli.sh`), built on a
  Mac so the Mac ones are signed ad hoc; curl doesn't quarantine what it downloads.
- **The game** shows your computers on your own card (`web/src/hud/Computers.tsx`) and removes them; only the
  app's window can make a link code.

## Actors

**`player[userId]`**: raw events (SQLite, deduplicated), devices (the app and linked computers), sessions,
login codes and link codes. Events from every device land in the same table, so a linked computer's usage
counts everywhere with nothing else to add up. `ingest` stores a
batch, recomputes the touched world days (per-model sums, prompts, PRs, 5-minute agent buckets) and sends them
to `town.report`, then tells `world` how many agents are live, and `arcade.usage` in case they're in a battle.
- **The numbers come from the user's own machine,** so they're bounded rather than trusted: an event over 1B
  tokens in any field, or stamped over an hour ahead, is dropped (`validate.ts`); model names that aren't
  model-shaped count as `unknown` (they're shown on profiles). Each minute counts for at most 200M tokens
  (`USAGE_MINUTE_CAP`; a busy real day is ~1.5B): past it, that minute is scaled down and the rest goes in
  `capped_daily`, which flags the account on the admin page. That also keeps every `SUM` far below SQLite's
  64-bit limit, where it would throw and take the leaderboards down.
- Per player: 60 ingests a minute and 500,000 new events a world day. Past either, the app's sync fails and
  picks up where it stopped on its next run, so a big first sync is delayed, never lost.

**`town["main"]`**: everything cold, joined in SQL.
- Tables: `users`, `companies` (ids never reused), `usage_daily`, `activity_daily`, `capped_daily`,
  `purchases` (coins spent, per kind), `items` (one row per copy anyone holds), `rewards` (level rewards
  handed out), `loot` (raid drops handed out), `ledger` (coins held and paid by games, and traded), `trades` (one open offer per sender),
  `offices`, `company_ledger` (company wallets), `match_players` (one row per player per finished game),
  `deleted_users`, `lost_signups` (ids of sign-ups whose `player` failed to start), `admin_log`.
- Accounts: `signUp` (20 an hour per IP, 1,000 an hour in all), `rename` (10 an hour), `setLook` (refuses items you don't hold), `me`.
- Companies: create (on a plot the owner picks: any empty block next to the town, see `frontier` in
  `core/src/maps.ts`), leave, kick, rename, `setWebsite`. One company per person, at most 50 members. The
  earliest joiner takes over from a leaving owner; the last one out closes the company. The town is built from
  its companies' plots (`townMap`), so it grows as they start and shrinks, or gets a park, as they close.
- Joining: `listings` shows every company; `apply` asks to join one (one pending application per person,
  applying elsewhere replaces it); the owner will `approve` or `decline`, and `withdraw` takes it back. The
  owner hears about an application, and the applicant about the answer, through `world.notify` (a `notice`
  event, shown as a toast). A new player's first visit opens this choice.
- Stats: `leaderboard`, `profile`, `today` (the HUD's corner), `searchNames`, `gameBoard`. Cost is priced
  when read.
- Coins: `wallet`, `buy`, `bag`; for `arcade`: `hold`, `pay`, `refund`, `recordMatch`. Games: `gameBoard`.
- Trades: `offerTrade` (10 an hour; a new offer replaces your old one), `trades`, `acceptTrade`,
  `declineTrade`, `withdrawTrade`. See *Coins and the shop*.
- Office decor: `setDecor` and `buyDecor` (wallpapers and floors), `setDesk` and `buyDesk` (desk setups), `buyDeskFleet`
  (a company's), `openOffices` (who is open and who's in them); `setDecor` shares the next limit. See *Offices v2*.
- Offices: `setOfficeOpen` (your own, from level 10; 30 a minute, since each one sends the office and its
  building to everyone inside). What's in an office is what its owner dropped there.
- Drops: `drop` (30 a minute) takes one of a kind out of your bag (not a reward; at most 5 of yours on the
  floor at once, not counting your own office's) and asks `world.placeDrop` to put it where you are; a full
  room says so, and the row comes straight back. On the floor a row has `owner_id` NULL, with `dropped_by`
  and `dropped_at`, and `room`, `x`, `y` once `world` has put it down (`placed`). `pickUp` (from
  `world.take`) puts it in the taker's bag, if it's still on that room's floor. **The sweeper** is a cron alarm
  (`sweep`, every 10 minutes; it outlives restarts and wakes the town): drops nobody took in an hour come
  off the floor (`world.removeDrops`) and go back to their droppers, except what's in its dropper's own
  office: that's furniture. A closed company's building and a deleted owner's office give theirs back at
  once (`removeCompany` and `removePlayer` return the ids), and so does a rebuilt town or building for
  drops it has no place for any more (`setCompany` and `setPlayer` return them); a deleted account's own
  drops are deleted with it, office furniture and all.
- Admin (`town/admin.ts`, for `/admin`): `adminOverview`, `adminUsers` and `adminCompanies`; rename people
  and companies; set a balance (the difference goes in the `ledger` as kind and ref `admin`); take someone
  out of their company; close a company; wipe someone's usage (their `player` drops its raw events too:
  `wipe`); delete an account. Every change goes in `admin_log`, shown on the page's Log tab. Deleting drops their usage, activity,
  purchases, items, rewards, application and trade offers, hands over or closes their company, takes them out of `world`
  (`removePlayer`) and destroys their `player` (`close`), so every token and session stops working. It's
  refused while they have coins in an unsettled game. Their `ledger` and `match_players` rows stay, and
  `deleted_users` keeps new ids above theirs, so nobody inherits them.
- Every change a player could see is pushed to `world` (`town/sync.ts`); `world` asks `town` only to put a
  taken drop in the bag (`pickUp`), and for every floor and office lock (`seed`) when it starts, and for
  everyone too when it starts from nothing.

**`world["main"]`**: everything live, in actor state, with chat in SQLite (last 200 lines per room).
- A 10 Hz tick sends each room its `moves`, and who's inside each house (`houses`, for town) when it changes.
  Head counts (`occupancy`) go to every connection, so at most once a second: sent every tick, a burst of joins
  stalled the world at 300 connections.
- Actions: `join`, `step` (one adjacent walkable tile, no faster than running; doors change room), `sit`,
  `drink` (a coffee machine: each cup adds 90 s of shaking, up to 6 stacked, sent as `coffeeUntil` in `info`),
  `say` (20 a minute; `@name` sends `mention` to someone in another room), `back` (after a game), `visit`
  (someone's open office, from their card), `take` (G: the drop you're on, or a blocking piece you face; on
  an office floor, only its owner).
- Events: `snapshot` (on joining or changing room), `moves`, `info`, `companies`, `occupancy`, `houses`, `notice`,
  `chat`, `mention`, `drop`, `pickup`.
- **Drops** (`DROPS`, in memory only: `town` has every floor, and a starting world forgets its own and lays
  them again from `seed`; at most 30 a room, 40 an office): a hat or a pet lies as itself on the dropper's
  tile or the nearest free one; furniture goes on the tile they face or the nearest free one to it, as
  itself in the room's map (`mapOf`), so a dropped sofa seats. Furniture never lands in front of a door, in
  a building's hallways or at the foot of the passage up to them, or where it would leave anyone in the room
  no way out. An office's map is the template and its drops. `take` lifts it off the floor first, then asks
  `town.pickUp`; if that call fails, it goes back down.
- **Resting.** Closing the last tab sends you to your bed; offline with agents active in the last 10 minutes, to
  your desk. Company members rest in their house, others at the Inn. Your spot is remembered: the next `join` puts
  you back there, unless it's a house you've left, an office that's closed or gone, or a tile that's a wall or
  furniture now (`back` after a game too); a seat that's gone, you wake standing where it was.
  Online with 3 minutes without input, you just doze where you are (`dozing`, drawn as a "z") until
  your next input, so a town left open on a second screen keeps showing what's going on.
- **The Inn's sleepers are a number.** Everyone without a company sleeps at the Inn, so its offline sleepers come
  as `asleep` in the snapshot (and in `moves` when it changes), drawn as "💤 N asleep", not one by one. They join
  the room when they wake up or sit down to work, and leave it when they fall asleep there. Company houses (50 at
  most) still show everyone.

**`arcade["main"]`** and **`match[id]`**: the mini games; see *Games*.

## Companies and houses

- A house's size follows its 30-day tokens **per member** (`houseTier`): basement, shack from 100M, cottage
  1B, house 5B, villa 15B, mansion 40B.
- **Websites** (`brand.ts`). The owner sets one; it goes on the sign at once. If `FIRECRAWL_API_KEY` is set,
  Firecrawl's `branding` format reads the site's colours and logo. Claude (`claude-opus-5-5`, low effort,
  structured output) turns them into roof, wall, trim and plaque colours; without `ANTHROPIC_API_KEY` the site's
  own colours are used. The logo is downloaded from public hosts only (no private or loopback addresses, a few
  redirects, images up to 512 KB), and served from `/logos/` with a sandboxing CSP.

- **The company wallet** (`company_ledger`). Every coin a member earns from tokens (`coinsForTokens`, not
  podiums or quests) is matched 1:1 into their company's wallet, on top of their own: `report` runs
  `matchCoins`, which adds what each touched day's coins grew by since it was last matched (kind `match`,
  ref the day), to the company they're in now, from the day they joined. Outsiders' merch purchases go in
  (`merch`), furniture comes out (`furniture`); an admin can set it (`admin`). Each row names who earned,
  bought or paid. The first migration back-filled current members' days since they joined.
- **Company furniture** (`COMPANY_FURNITURE`, 29 pieces drawn in `web/src/art/furniture-fancy.ts`): the owner
  buys from the wallet (`buyPiece`); any member puts pieces out (`placePiece`, down in front of them in the
  building) and takes them back (G) into the storeroom. Rows are `items` with `company_id` and no
  `owner_id`, so they're never in a bag, the sweeper leaves them, and they go when the company closes.
- **Merch** (`MERCH`): every company's tee, hoodie, cap and mug (`merch.<companyId>.<kind>`), in its colours
  with its initials, worn through `look.merch` and `look.merchWorn`. Outsiders pay full price, into the
  company wallet; members get `EMPLOYEE_MERCH_DISCOUNT` off (1.0: free, one of each). Not tradeable.

## Coins and the shop

- Each world day pays `√(tokens ÷ 1M)` coins (1.5B ≈ 38, 600M ≈ 24, 100M = 10). Finishing a day 1st, 2nd or 3rd
  adds 25, 15 or 10.
- Only days from the world day you signed up count, for pay and for podium places: a first sync backfills
  old logs, and those days would otherwise pay out (and win podiums nobody else was around for).
- Balances aren't stored: they're worked out from `usage_daily` minus `purchases`, so a late sync still pays.
- Two daily quests (`core/src/quests.ts`) pay up to 7 more a day: 5 agents at once, and 2 hours of
  agents running. They're worked out from `activity_daily`, so nothing is stored.
- The catalogue (`core/src/shop.ts`): 4 outfits, 3 glasses, 3 hats, 5 pets and the 11 pieces of furniture
  (`furn.<ch>`), 10 to 1,500 coins. The raid's 16 loot items are in it too, never sold (see *The raid*). Items are worn through `Look` (`outfit` ≥ 8, `glasses`, `hat`, `pet`).
  Pets follow their owner in the client (`game/pets.ts`: `followPet`), except in the owner's own office,
  where they go to the bed and sleep (`art/pet-sleep.ts`: `sleepingFrame(petFrame(...), left, tick)` derives
  the curled pose from any pet's normal frame: legs and tail tucked, squashed, eyes shut, a breathing bob and
  rising z's; so every pet and every variation of one has it, cached per source canvas).
- **Pet looks**: every shop pet has variations (`PET_VARIANTS` in `core/src/pets.ts`: the ids, in a fixed order
  that saved looks depend on, so only append). `Look.petVariant` is 0 for the pet as the shop sells it and n
  for `PET_VARIANTS[pet][n - 1]`; `parseLook` refuses one `>= petLooks(pet)` (so any variant without a pet),
  and old looks parse as 0. Holding a pet unlocks all of its looks, free: `setLook` needs only the pet in the
  bag plus the bound. Taking a pet off or losing its last copy (`unwear`) resets the variant, and so does
  wearing another pet from the bag. The art is in `web/src/art/pet-variants/` (`variantArt`, `missingArt`;
  `petFrame(pet, left, hop, variant)` falls back to the original while art is missing); `web/test/pet-variants.test.ts`
  checks every grid. In the 🎒 a pet kind with looks has a 👁 button that opens `PetLooks` (the `petLooks`
  panel): every look hopping, the worn one marked; picking one wears the pet in it. Dropped and shop pets
  are always the original.
- **Pet names**: `Look.petName` (optional) is saved with the look: `cleanPetName` (`core/src/pets.ts`) trims it, makes
  runs of spaces one and allows letters, digits, spaces, apostrophes and hyphens, 1 to `PET_NAME_MAX` (16) long;
  `parseLook` refuses a bad one and old looks have none. The ✏️ in the bag names (and wears) a pet; an empty name
  clears it. In the world the name is a small label under the pet, for your own and for pets within a few tiles.
  `PET_NAMED` is a table of costumes (name, pet, look, art id) matched case-insensitively on the cleaned name by
  `petOutfit`; the art is in `web/src/art/pet-variants/named.ts` and `petFrame` takes it as its last argument, so it
  works in every frame, the sleeping pose and the picker. To add one: append a row, add its art.
- The wardrobe (`core/src/wardrobe.ts`, art in `web/src/art/wardrobe.ts`): 36 more, each with a rarity and a
  line of flavour: 12 outfits (`outfit` ≥ 13), and three slots of its own: `held` (in the hand), `back` and
  `petwear` (drawn on the pet). The rubber duck, cape and jetpack are level rewards at 5, 15 and 25.
- **The bag** (`items`, the 🎒 panel): one row per copy, so you can hold two Ducks; you can wear a kind if you
  hold one. Buying adds a row and adds the price to `purchases` (spend only, one row per kind); buying a
  kind you hold already is fine. `bag()` counts each kind. What's on a floor isn't in anyone's bag.
- **Milestones** (`core/src/milestones.ts`): levels go to 50 (130B lifetime tokens; past 30 the steps grow
  2B, 3B, 5B, 10B). Every tenth level gives a title for the player card, coins and an item: a top hat,
  server-rack armour, a Singularity orb, a Nebula visor and golden regalia, at 10 to 50. The coins are worked
  out from the level in `wallet` like the rest, so nothing is stored. Level 50 also draws a golden aura and halo
  and a crown on the pet, from the level alone (`web/src/art/aura.ts`). `report` hands them out as rows the first time a sync reaches the level (`grantRewards`, once each,
  recorded in `rewards`), with the office's desk and chair at level 10, dropped on its floor
  (`starterDrops`; in the bag if it has furniture already). `setOfficeOpen` hands them out too, for anyone
  who reached level 10 before offices had rows. Rewards are `tradeable: false`.
- **Trades** (from a player card): up to 🪙 500 and 4 items each way, for 7 days; not rewards, and not
  furniture on a floor (pick it up first). Accepting re-checks both sides under `serial` and moves everything in one
  transaction (`settleTrade`): coins through the `ledger` (kind `trade`), items by moving one row of each kind
  to the receiver. Spend stays in `purchases`, so balances don't change. A kind you no longer hold comes off
  your look. While an offer is open to or from you, a 🔁 beside the Bag opens your trades (`wallet.trading`).
- **Offices.** From level 10, every company member has one behind a door with their name on it in the
  company building (`office:<userId>`, one map template plus their furniture). The doors are in hallways of
  10 above the building's floor (negative `y`, `hqMap`), which `world` rebuilds when a door comes or goes.
  Furniture is the map legend's own pieces, bought into the bag and furnished by dropping: in your own
  office a drop stays (no hour, no five), at most 40, and only you take anything off its floor, a
  visitor's gift too. The Menu opens or closes it while you're in it; opening it clears its chat, so
  visitors never read what was said while it was closed. Anyone in the building walks into an open office;
  from outside, from the owner's card. The template has a **pet bed** in its bottom right corner: the map
  tile `Q`, a prop like a plant (not walkable, so nothing can be dropped on it and it can't block a path).
  While its owner is in their own office their pet walks to it and sleeps there, for everyone in the room to
  see; it's all drawn on the client (`game/pets.ts`), the server knows nothing of it. Sizes, wallpapers and the
  list of open offices are in *Offices v2*.

## Games

**Decided:** stakes only (every coin a winner gets came from the other players; no house prize and no town
cut). A stake is at most 500 and half your balance, a side bet at most 200, one game at a time. Every game
gathers in the town square so anyone can watch, and you play in a panel over the world.

**The games:**
- **Ship, Pivot, Raise** (1v1): rock-paper-scissors for founders, best of 5, 15 seconds a pick.
- **Hype Cycle** (2–8): the valuation climbs as e^(t/12) until it crashes; cash out in time. Three rounds.
  Each round's crash point comes from a seed whose SHA-256 is shown before it and the seed after.
- **Due Diligence** (2–6): Liar's Dice with 🦄 wild, 30 seconds a turn; the last with dice wins.
- **Sprint Race** (2–8): a typing race like Monkeytype, 15, 30 or 60 seconds after a 3-second countdown. The
  same seeded words from the 200 most common English ones for everyone, lowercase and with no punctuation.
  WPM is (letters of correct words + their spaces) ÷ 5 ÷ minutes; ties go to accuracy, then whoever got there
  first. The client sends the text as it's typed; the rules score only what arrived in the race (plus half a
  second for the network), at the server's clock, refuse text faster than 250 WPM, and nobody sees anyone
  else's text. In town the racers run laps of the square while it's on, a lap per 83 correct characters (10
  seconds at 100 WPM), from the game's `board`; only the client draws it (`web/src/game/race.ts`), so on the
  server they stand at the table as usual.
- **Tokenmaxxing** (2–12): the most real tokens in 15 minutes to 24 hours, starting on the minute after a
  minute's countdown, with 3 minutes of grace for late syncs.

- **Rules are pure** (`core/src/games/`): each game is a `GameDef` over plain JSON state: `setup`, `move`,
  `tick`, `forfeit`, a per-viewer `view` (hiding what a player mustn't see yet), `outcome` (places, or void),
  plus optional `callouts`, `status`, `board`, `headline` and `endsAt` for the world. Usage games add
  `usageWindow` and `usage`. `GAMES` lists them: Ship, Pivot, Raise; Hype Cycle; Due Diligence; Sprint Race; Tokenmaxxing.
- **`arcade["main"]`** is the social side and the money. Everything starts as a table: `open` (invite people,
  open it to anyone, or both), `invite`, `answer` (yes, no or a counter offer), `join`, `leave`, `start`. A
  full table starts a match. It also takes side bets, runs double or nothing, and `settle`s: the pot is paid by
  place (`core/src/games/payouts.ts`, integer math), side bets are a parimutuel pool, and a void game refunds
  everything. Each connection gets its own `lobby` event.
- **`match[id]`** runs one game: its tick loop, frames per viewer (`frame` events), forfeits after 20 seconds
  away for games that hold their players, and a 20-minute safety net. It tells `world` the live status, and
  `arcade` that it moved on and how it ended.
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
  twice, and the arcade calls off a match that got stuck, refunding everyone: a held game that hasn't moved on
  in 3 minutes (an engine hiccup can leave its match dead; the rules move it on within a minute), or any match
  still running after 30 minutes (25 hours for Tokenmaxxing). A match that ends after a restart lost it from
  the arcade's state is refunded too. The arcade retries letting the players go, and destroys match actors a
  minute after they end.

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
  (blackjack), Unicorn (highest unique number), a coin flip at the fountain, and
  fighting "Rate Limit" in the tall grass.

## The raid

Every week a ladder of bosses waits in the Raid Dungeon, down the gate in the square, and the whole town
climbs it together (`core/src/raid.ts`).
- **The ladder:** The Rate Limit, The Context Window, Merge Conflict, The Hallucination, then round again as
  "II", "III"… (`bossAt(rung)`: same sprite ids, plus `rung` and `level`). When a boss falls, the next appears
  at once and the overflow carries over. A day that does enough brings down several, all on that day, in order.
- **Launch:** the first raid opens at 08:00 on the Monday after the town first had the raid
  (`launchWeek`). `raidStart` stores that Monday once in `raid_meta` (key `start`) when `town` wakes, so
  restarts and deploys don't move it; `RAID_START_WEEK` (a Monday, checked at boot) overrides it for dev and
  testing. The pure rules take it as `start`. Until it opens the view is `prelaunch` (with `launchAt`): rung 1
  behind a closed gate, its `hp` so far, and no kills, raiders or coins.
- **The teaser:** before the launch the gate is boarded up and taped off under a ⚠️ sign, a violet glow leaking
  through, rumbling every few seconds, with the odd line from inside ("Your rate limit is coming.") and
  "⚠️ Something is coming… 3d 04:12:55" over it, to the second. The corner box and the panel count down too;
  the panel shows rung 1 as a shadow ("???"), its HP so far and how the raid works. The dungeon can be walked
  into, but it's dark and empty: no raiders, just the first boss's shadow. The client asks again the moment
  a shut gate opens (`gateTimer` in `net.ts`, past the 5 s throttle), and `raidsOf` drops its cache when the
  raid week changes, so 08:00 is on time. When `prelaunch` flips the boards burst off the gate, rung 1 drops
  onto its dais and a toast says "⚔️ The Raid Dungeon is open: The Rate Limit awaits."
- **HP:** the first raid's rung 1 (`start`) is 10% of the week before's damage, at least 2B (`hpFor`);
  every week after, rung 1 is ×1.1 the week before's (`WEEKLY_GROWTH`, `weekHp`), so week n is
  `first × 1.1ⁿ` whatever the town did. Each rung is ×1.5. Clearing n rungs costs `2 × rung 1 × (1.5ⁿ − 1)`,
  so 4 rungs are 81% of the week that set the first ladder: a week like it clears four and stands at the fifth.
- **Damage** is every token you sync that week, no cap, and 25M for every PR you open. (Ingest still counts
  at most 200M a minute, `USAGE_MINUTE_CAP`, to stop made-up numbers.)
  Only days from your sign-up day count, as with coins.
- **Rewards per kill:** rung n pays each of its raiders 10 × 1.5ⁿ⁻¹ to the nearest 5, at most 50 (10, 15, 25, 35, 50, 50…), so four
  kills are 85 (`RAID_COINS` and `RAID_COIN_CAP`). A kill's raiders are everyone with 10M+ that week up to and including its day, so
  joining on Sunday doesn't pay for Wednesday's kills.
- **The week** is Monday to Sunday in world days, but the gate opens at 08:00 on Monday: until then
  `raidWeekAt` is still last week, as it ended, and the new ladder appears at 08:00 with Monday's early tokens
  in it. Usage is stored per world day, so the damage can't start at 08:00; the night off only moves what's
  shown, and the history (and with it wallets) follows it, so nobody is paid for a kill before it's shown.
  The view has `opensAt` and `endsAt` (the next Monday 08:00), and `closed` before the gate opens.
- **Nothing is stored.** Like balances, the raid is worked out from `usage_daily` and `activity_daily`
  (`server/src/town/raid.ts`), so a late sync still lands its hits. `town` keeps the result for 15 seconds
  (`raidsOf`), however many people are polling. `wallet` and the admin page's `balances` add raid coins.
  The week before the first raid (`start`) only sets its HP, so nobody is paid for bosses that weren't there.
- **In the game:** `town.raid` is polled with the stats (every 30 s). `hp` and `damage` are the current rung's;
  `kills`, `totalDamage` and `last` tell the rest. The corner box and the panel (the ladder: kills, the
  current rung, the next three greyed) are `web/src/hud/Raid.tsx`; a toast says each kill and its coins
  (in the dungeon the toasts go to the bottom, clear of the boss's name and HP).
- **The dungeon** (`MAPS.dungeon`, room `dungeon`): the gate `G` in the square (its sign: boss, rung, HP; a
  portcullis and "opens 08:00" while `closed`), or the panel's "Go to the dungeon" (`world.enterDungeon`).
  The boss stands on a dais (`Z`, not walkable) facing 40 war desks (`l`, with a seat `r` below each: props,
  not seats anyone sits in). Whoever walks in is a spectator; everything else is drawn in
  `web/src/game/raid.ts`, and only in that room.
  - **Raiders:** everyone whose agents ran in the last 10 minutes (`WORKING_MS`), wherever they are, asleep
    or offline included. `world.raiders` sends the busiest 40 (`RAIDERS_SHOWN`) as {id, name, look, agents,
    burn} and how many more, in the dungeon's snapshot and then as `raiders`, only to the dungeon and at most
    once a second when it changes. The client keeps each one's seat while they stay; a newcomer gets the
    seat their id hashes to, or the next free one (`seatFor`), among the front seats (in bands of 10 for
    the crowd), so the same person has the same desk after a reload.
  - **Burn:** after each ingest `player.report` sends `world.activity` the live agents and the tokens a
    minute over the last 10 minutes of events (minute-capped like the games). `world` fades it linearly to 0
    as that last event gets 10 minutes old, so someone who stopped slows down before they leave their desk.
  - **Missiles:** each laptop fires `√(burn ÷ 100k)` a second (1 at 100k a minute, at most 6), or the odd
    sputter when idle; each agent past the first is a robot minion by the desk (8 drawn, then "+N") firing a
    third as fast. At most 150 missiles and 160 sparks at once. They only show the burn: the real hits are
    every synced token, floated off the boss as the `totalDamage` each poll adds.
  - **Kills:** the boss slumps by a trophy, then the next rung's drops in under a "Rung N" banner; this week's
    kills hang as plaques on the back wall. While `closed`, nobody fires and the one that got away dozes.
- **Loot** (`core/src/loot.ts`): each boss has its own table of four items, one per rarity: common 10%, rare
  2.5%, epic 0.5%, legendary 0.1%. Each lap of the ladder ("II", "III"…) multiplies the odds by 1.05, at most
  ×10 (`lapBonus`: a 0.1% legendary is never above 1%, and ×10 takes 48 laps). The weekly +10% difficulty of the ladder is separate and never raises odds.
  - The Rate Limit: Hourglass hat, 429 shades, Sand golem (pet), Golden Hourglass (trophy).
  - The Context Window: Pane glasses, Compacting… scarf, Goldfish (pet), Infinite Context Crown.
  - Merge Conflict: Two-tone suit, `<<<<<<< HEAD` band, Forked cat (pet), Golden Rebase (trophy).
  - The Hallucination: Third eye, Shimmering cape, Ghost (pet), Citation Needed crown.

  They're shop items in the existing slots (`ITEMS`, with `loot: { boss, rarity }`), each slot's after
  everything sold in it (`LOOT_FIRST`: after the head pack and the wardrobe), so they're worn, placed,
  dropped and traded like any other, but never sold. Trophies are furniture: `Y` and `V` on the map legend,
  after the shop's pieces in `PIECES`.
  - **Rolls:** every raider a kill pays (`Kill.raiders`) rolls every item in that boss's table on its own, so
    one kill can drop several things for one person. A roll is the first 52 bits of
    `sha256("loot:<week>:<rung>:<userId>:<item>")` over 2⁵², and it drops when it's under the odds
    (`killDrops`). It's the same every time it's worked out, so nobody can reroll, a restart changes nothing,
    and anyone can check it.
  - **Granting** (`server/src/town/loot.ts`): like the raid itself, drops are worked out rather than
    stored, but an item has to be a row, so each drop is handed out once. Every time `town` works the raid
    out (`raidsOf`: a poll at most every 15 s, and the sweeper's alarm every 10 minutes, so nobody has to be
    watching), `grantLoot` finds the drops not yet in `loot` (primary key week, rung, user, item) and inserts
    each one's `loot` row and `items` row in one transaction, under `serial`. A late sync that makes someone
    a raider gets them that kill's rolls then. A drop is handed out before the poll that shows its kill
    returns. Loot stays when usage is wiped, and the rows stay when an account goes, like the ledger.
  - **News:** each winner gets one `notice` (the rarest first, opening the Bag). `world.announceLoot` sends
    this week's drops (at most 40) to everyone as `loot`. In the dungeon each item pops out of the boss in a
    beam of its rarity's colour and flies to its winner's desk (`web/src/game/loot.ts`). A legendary floods
    the screen gold with a banner wherever you are, and an epic does the same in violet. Outside the dungeon
    a toast says who got what. Whoever wears a legendary sparkles in the world.
  - **The panel:** `town.raid` adds `loot` (`raidLoot`): the current boss's table with its odds on this
    rung, ticked if you hold one, and this week's drops with who got them. The Bag and the Shop frame loot in
    its rarity's colour (common green, rare blue, epic violet, legendary gold, glowing), and the tooltip names
    the boss and the odds.
  - `RAID_LOOT_BOOST` (dev and testing only, 1 to 1000, checked at boot) multiplies every drop's odds so
    rare ones can be seen without luck. The panel says when it's on.

## Offices v2

- **Sizes** go by the owner's level (`OFFICE_SIZES`): 12x9 from level 10, 14x10 at 25, 16x12 at 40
  (`officeTier`, `officeMap`). An office only grows right and down, so every tile and placed piece keeps its
  coordinates; the tier is in `owner` in the snapshot and the open-offices rows.
- **Personal furniture** (`core/src/home.ts`, art in `web/src/art/furniture-home.ts`): 14 cosmetic pieces for
  personal offices only, 40 to 260 coins from the shop (plants, a keyboard in a glass case, a whiteboard, a floor
  lamp, bookcase, duck shelf, mini fridge, wool rug, bean bag, neon sign, framed certificate). They are `Piece`s
  flagged `home`, ordinary tradeable bag items (`furn.<ch>`), but `canDropIn` lets them down only in your own
  office, never the company house. Nothing earns or buffs anything. The wall ones (`wall`: whiteboard, certificate,
  hanging plant, neon sign) hang on the office's single wall row (`OFFICE_WALL_ROW`, `canHang`/`wallSpot` with
  `home`), over bare wall (not the corners or the trophy shelf) with free floor in front, so they never block a step;
  their art is one tile (16 px) tall. A floor piece is refused (`cutsOff`, core/src/world.ts, checked in
  `placeDrop`) if it would leave the door, the desk, a seat, the pet bed or itself unreachable from the exit.
- **Decor** (`core/src/decor.ts`): 10 wallpapers and 10 floors per owner, not bag items. A paid one (40 to 300 coins)
  is bought once (`buyDecor`, a `purchases` row `decor.<kind>.<id>`); Tivoli (level 25) and the Bornholm cobble
  (level 40) come with the level and are never sold. `setDecor` switches between what you own for free, kept in
  `offices.wall` and `offices.floor` (NULL is the plain one), and `world` rebuilds the office map.
- **Open offices** (the Open offices entry in the Menu, or E on a `w` board tile): `town.openOffices` joins
  `world.openOffices` (open offices with their level, company, size and how many are inside now) with distinct
  visitors in the last 7 days (`office_visits (owner_id, visitor_id, day)`, written once a day per pair when
  `world` sees someone step in: `countVisit`, `town.officeVisit`; older days are pruned on write). Busiest first,
  at most 30, one read shared by everyone for 5 s. The `offices` table gains `wall` and `floor`; the code is in
  `server/src/town/offices.ts`.

## Desk setups and posters

- **Desk setups** (`core/src/desks.ts`): five cosmetic tiers, Laptop (free), Dual monitors, Triple monitors, Ultrawide
  and Battlestation, at 40, 120, 300 and 600 coins; Ultrawide and Battlestation also come free at levels 25 and 40.
  A bought one is a `purchases` row `desk.<id>`; the one in use is `users.desk` (NULL is the laptop), set for free
  with `setDesk` and carried to everyone as `PlayerInfo.desk`. Nothing about it is a gameplay edge.
- **The company's desk fleet:** any member can buy the house's next tier from the wallet (300, 700, 1,400 and
  2,500 coins; `companies.desk_fleet`, a `company_ledger` row of kind `desk`). At a desk in the house the client
  draws the better of the sitter's own setup and the fleet (`effectiveDesk`); empty desks show the fleet tier with
  dark screens. The art is `web/src/art/desks.ts`, and the Desk panel is `web/src/hud/OfficeDesks.tsx`.
- **Posters** (`core/src/posters.ts`, art in `web/src/art/furniture-posters.ts`): ten parodies of well-known game genres,
  60 to 250 coins from the company wallet, in the company furniture catalog (a "Posters" group). They are
  `COMPANY_FURNITURE` entries flagged `wall`: they hang only on row 1 of the company building (`canHang`,
  `wallSpot`), over a bare wall tile with a free floor tile in front, so walking is never affected. G takes one
  down, and `liftMisplaced` returns one to the storeroom if the map changes under it. The stock house has room for
  seven at a time.

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
- rate limits are in memory, so a deploy resets them;
- usage is reported by each user's machine: capped and flagged, but it can't be proven;
- leaderboards are kept until something on them changes (`boardsChanged`, called on every push to `world`),
  and wallets are recomputed on every request, against podiums kept per day and the raid kept for 15 s;
- a late sync can knock someone off a past podium after they spent the bonus;
- the logo download checks DNS before fetching, so DNS rebinding in between isn't caught.

## Tests

`bun run check` runs typecheck, lint and every test. `bun run test` runs the files in parallel; plain `bun test`
runs them in one process. Actor tests start a real server in a subprocess per test process, with its own engine,
free ports and data directory (`server/test/rivet.ts`), so they use the production code paths. CI runs two
workers, since more stall the engines on its runner, and turns on quick ACKs for loopback, which takes most of the
remaining wait out of each actor call (see `RIVET__GUARD__TCP_NODELAY`). Map, step, rest-spot and coin rules are
pure and tested in `core/test/`.
