# Plan: clean up before the release (2026-09-29)

This comes from reading the whole repo: server, web, core, the app, tooling and docs. Each item names where it
is and what to do. They're ordered by what matters for the release, and each numbered group is one commit.

## 1. Fix before release (bugs and risks)

1. **A game whose ending fails is stuck for good.** `match.finish` calls `arcade.finished` once
   (`server/src/actors/match.ts:293`). If `settle` throws (say `town.pay` refuses), the match never gets an
   outcome. `busy()` then keeps its players out of every game, their stakes stay held, and a failed
   `world.release` (errors ignored, `arcade.ts:555`) leaves them frozen as `playing`.
   - Retry `finished` from the match's run loop until it succeeds.
   - Have `sweep` void any match with no outcome after a limit: refund it and release the players.
   - Delete `vars.finishing`; it never does anything.
2. **Spam gets around the invite rate limit.** Only `invite` checks it (`arcade.ts:162`). `open` with a list,
   open → leave → open, counter offers and `town.apply` all send toasts without a limit. Check the limit in
   `addInvites` and in `tell`/`notify`.
3. **Notifications fail in different ways.** The arcade's `tell` swallows errors, but `town`'s `notify`
   (`town/sync.ts:53`) throws, so `apply` saves the application and then errors. Make them best-effort
   everywhere.
4. **The arcade's name cache goes stale and only grows.** `state.names` (`arcade.ts:76,426`) never learns
   about renames and is kept forever. Store the name on each seat and invite, the way matches already do,
   and drop the map.
5. **Match actors are never destroyed** (no `destroy` anywhere). Destroy each one when the arcade drops it
   after `KEEP_MS`.
6. **The app now always reads GitHub, and on every sync.**
   - The README doesn't list GitHub as a source (`README.md:30-38`), yet `gh search prs --author=@me` runs and
     sends PR hashes and times. Now that sources can't be turned off, say so.
   - It runs on every sync: every 2 minutes, and every 10 s during a battle (`core/src/sync/collect.ts:185`).
     Search at most every 15 minutes, using a timestamp in `SyncState.github`.
7. **Helper tests and `helper:once` touch real data.**
   - `SyncOptions` doesn't pass `gh` through (`core/src/sync/sync.ts:5-11`). So `helper.test.ts` runs the
     developer's real `gh`, which sends their PRs to the test server and makes a network call on CI.
   - `helper:once` writes the installed app's state file (`app/helper/src/main.ts:12`), which moves its read
     positions forward so that usage never reaches production.
   - Fix: pass `gh` through (`null` in tests), and use a separate state directory when
     `TOKENMAXXING_SERVER_URL` is set.
8. **Web bugs.**
   - Signing out leaves the `arcade` and `match` connections open (`web/src/net.ts:71-86`).
   - Clicking the "Stake" label text sets the stake to Free, because the `<label>` wraps the preset buttons
     (`web/src/hud/Arcade.tsx:374`). Use a `<fieldset>`.
   - Buy, Accept and Invite can be double-clicked; a shared `useRun` with a `busy` flag fixes it (see 4).
9. **Things running when they don't need to.**
   - Hype Cycle redraws its whole panel every animation frame and keeps going after the game
     (`web/src/games/hype.tsx:10-21`). Only redraw the curve and the multiplier, and stop when it's over.
   - `InviteToast` ticks every second forever (`web/src/hud/Arcade.tsx:437`). Tick only while an invite shows.

## 2. Delete what the one-button menu bar app no longer needs

- **The battle poll.** The helper only needs "am I in a battle, and until when?" (`helper.ts:139`).
  - Make `arcade.battle` return `until | null`.
  - Delete `match.battle` and the `Battle` type (`core/src/protocol.ts:30`).
  - Or: `player.ingest` returns the `until` that `arcade.usage` already computes (`player.ts:210`) and the poll
    goes, but a battle is then only noticed after a sync that sent something.
- **`town.menuBar`**, now only the web's stats poll (`web/src/net.ts:148`):
  - rename it (`today`);
  - skip the company half of `boards()`;
  - send the top 5 the mini board shows.
  - `me()` also computes `level`, `levelTitle` and `lifetimeTokens`, which the web never reads.
- **Other leftovers:**
  - `AppState.version`, the `{ name }` reply to `signUp` (and `CommandResult.name` in Swift), and the
    `--version` flag;
  - `SyncState.lastSyncedAt`, plus the extra state write it costs;
  - the `enabled` sync option (production always reads everything; tests can pass overrides);
  - `world.history` (only a test calls it);
  - `PricingCache.size` and `unknownModels`, and `loadPricingFallback`, which only tests use.
- **Server sign-out** (`player.signOut`, `town.forget`, `world.forget`, `forgetUser`) no longer has a caller.
  Either delete it, or keep it on purpose and add a "sign out everywhere" button in the world. **Your call.**

## 3. Docs

- The README and `ARCHITECTURE.md:21` say "three actors"; there are five (`arcade`, `match`).
- The cask description still says "Menu bar leaderboard…" (`packaging/tokenmaxxing.rb:11`).
- "Coming from 0.4?" (`README.md:24`): check that it's still true for this release.
- **GAMES.md** (578 lines) is a finished plan, and parts of it are now wrong (the battle line, `battleUntil`,
  stats listed under "Later", "start with step 1"). Move its "Later" and "Not built yet" lists into
  ARCHITECTURE.md's Games section and delete it.
- Stale comments:
  - "menu bar" in `town.ts:409`, `arcade.ts:354` and `match.ts:160`, and in two test names;
  - `rate-limit.ts:2` (says keys are IPs);
  - `vendor-pricing.ts:3` (wrong path);
  - `read-slice.ts` and `cursor-local.ts` (daemon, tokenleader, the old POST limit);
  - `codex.ts`: 218 comment lines, many of them history from tokenleader.

## 4. Duplication (one shared helper each)

**Server**
- A typed `main(c, "town")` client helper in `actors/shared.ts`:
  - it replaces 24 copies of `.getOrCreate(["main"], internal)`;
  - it fixes the untyped `c.client()` calls (`arcade.ts:176,211,315,360,374`, `match.ts:153`).
- The connection-auth block is written 4 times (`town`, `world`, `arcade`, `match`); make it one helper.
- SQL:
  - The token sum `input + output + cache_creation + cache_read` appears 6 times; make it a constant.
  - The activity sums appear twice in `boards.ts`.
  - `companyById` is rewritten inline 4 times.
- Validation: the same stake check twice in `arcade.ts` (`:124`, `:181`), and the same error messages twice in
  `town.ts`.
- `BUCKET_HOURS` (`stats.ts:33`) repeats `AGENT_BUCKET_MS` (`player.ts:28`).

**Web**
- `useRun` exists once and is copied 6 more times (CompanyPanel, Shop, Match, LookPicker, Chat,
  QuickReplies). Move it into `hud/ui.tsx` with a `busy` flag.
- Formatting belongs in `core/src/format.ts`:
  - `clock` is written twice (`game/games.ts`, `games/tokenmaxxing.tsx`);
  - there are two duration formatters;
  - 7 plural helpers can be one `plural()`;
  - "seconds left" is calculated 4 times;
  - agent hours show as "3h 25m" on the leaderboard but "3.4h" on the card.
- Add `name(id)` and `look(id)` to `GameProps`; every game component writes its own.
- The Leaderboard's nested ternaries (`metric`, `shown`, `aside`, `gameValue`) can be one table per sort. The
  Games board's rows copy `Row`.
- One `useExpiring` hook replaces three copies of the toast timer (`Hud.tsx`). One `lobbySummary(lobby, me)`
  replaces the three slightly different definitions of "open tables" and "in a game".
- `hud.css` (1,476 lines): split it by area. Rules sit far from their siblings, and `.lb-sort` is declared
  twice.

**Core (log parsers)**
- One `event(source, fields)` helper replaces 7 hand-written 13-field `TokenEvent`s.
- `isString`/`isNum` are copied 3 times.
- The `seenDedupKeys` and `localSeen` sets are only read by tests; `collect` already deduplicates.
- The pre-v0.6.5 code for old saved state in `codex.ts:288` is dead, and so is the `CodexSessionTotals` alias.

## 5. Performance (the world's render loop)

- `pill` should return its size, so `hitPill` stops measuring the text again (`game/games.ts:78,186`). The
  banner text is also built twice.
- Cache wrapped chat bubbles by text (`game/labels.ts:165`).
- Precompute each map's object list instead of allocating objects and closures every frame
  (`game/render.ts:61`).
- Index companies by plot instead of spreading the map per building per frame (`game/houses.ts:41`).

## 6. Tests

- Replace fixed sleeps with a helper that polls until the expected state appears (`arcade.test.ts`, 9 places in
  `world.test.ts`). It's faster and less flaky.
- Timeouts: bun doesn't apply `setDefaultTimeout` from `server/test/rivet.ts` (CI timed out at 5 s). Set it
  once in a preload (`bunfig.toml`) and drop the per-test `30_000`s.
- Add tests for `collect`: forgetting deleted files, saving positions, deduplication across sources, and
  splitting into 1000-event sends.
- The codex tests read up to 150 MB from the developer's `~/.codex`, and do nothing on CI. Put them behind an
  environment flag.
- Share the in-memory SQLite setup (`ledger.test.ts`, `battle.test.ts`).

## 7. Small things

- Accessibility:
  - labels on the side-bet and counter-offer inputs and the chat input;
  - `aria-label`s on emoji-only buttons;
  - the modal needs `aria-modal` and focus;
  - toasts need `role="status"`;
  - `index.html` sets `user-scalable=no`.
- Exports used only in their own file, across server, web and core (about 30): drop `export`. Unused CSS:
  `.toolbar`. The store's `invite.at` is never read.
- Name the magic numbers: chat 20/min, step budget 4, invites 10/min, 12 invitees, 10_000 caps, `3_600_000`.
- Tooling:
  - add `"packageManager": "bun@1.4.2"` instead of pinning Bun 4 times;
  - drop the unused `version` fields in the workspace `package.json`s;
  - make CI one `bun run check`;
  - remove the stale `.gitignore` entries.
- The pricing refresh `fetch` has no timeout (`pricing.ts:117`). `town.report` inserts row by row.

## Order

1. Section 1 (the release blockers). Each item has a test where there's logic.
2. Section 2 and the docs (section 3). These are mostly deletions.
3. Section 4. These are refactors with no change in behaviour; the existing tests cover them.
4. Sections 5–7 as time allows.

## Decisions for you

- **Server sign-out:** delete it, or add "sign out everywhere" to the world?
- **Battle detection:** keep a small poll (`arcade.battle → until`), or learn it from `ingest` and drop the poll?
- **GAMES.md:** fold it into ARCHITECTURE.md and delete it?
