# Plan: gamification

The game is the **daily race** on the leaderboard. Each group's day starts at midnight, everyone starts at zero,
and during the day you get told when someone passes you, when you take #1, and when you're close. The next
morning the group gets a recap and yesterday's winners wear a crown. Each group also has a simple chat, shown
in the same timeline as those events, so people can reply to them.

We don't add pets, a currency or a shop (the parts of [PokeTokenBar](https://github.com/chattymin/PokeTokenBar)
we don't want). All of it comes from data we already store.

## Status (2026-09-28): built

All phases are built. `bun run check` (typecheck, lint, 192 tests), `swift test` and
`build-app.sh dev` pass. The server and dashboard were run against a local database with four users
racing, chatting and reacting.

**Not checked by hand:** the menu bar chat page and real macOS banners. Both compile and the protocol
contract test decodes every new message, but nobody has clicked through them in the running app yet.

**Where the build differs from the plan below:**
- **Feed state file.** The feed cursor, `chatReadId` and the last-call date live in `state.feed.json` next to
  the sync state, not in `SyncState`. `sync()` saves its own copy of `SyncState`, which would overwrite a
  cursor that moved in the meantime.
- **Best day and streak.** `best_day_tokens` isn't backfilled. It's recomputed together with the active streak,
  from one pass over the user's history, at most once per user per local day. During the first sync, recent
  events can arrive before older history, so no personal best fires on the signup day.
- **One migration.** The streak columns are in migration 1, because Phases 0–4 shipped together. Reactions are
  migration 2.
- **Command field names.** Commands use `momentId`, since `id` is already the request id in the helper
  protocol. `setChatOpen` treats a missing `groupId` as null, because Swift omits nil fields.
- **Notifications.** One or two moments in a poll are sent one by one; more than two collapse into the most
  important one plus "…and N more". Feed polls run one at a time.
- **Daily results.** `ensureDayResults` remembers checked groups in memory, and the dedup keys cover restarts.
- **Menu bar setting.** The "show in menu bar" toggle became a picker (icon / tokens / rank / both). The old
  setting carries over.

**Decisions taken (defaults, change before building):**
1. **A day is the group's day.** A group's day runs midnight to midnight in the **owner's** timezone (an IANA
   name, so daylight saving time is handled). The group races on one clock, and there's no group setting to build:
   if ownership passes, the timezone follows the new owner.
   - In a group view, the `today` leaderboard uses the group's day, so the board matches the race.
   - "All groups" keeps the viewer's own day, as it does now.
2. **The server detects moments, not the app.** Everyone in a group sees the same event once, and the web
   dashboard can show the same feed.
3. **Only the person who synced can move up.** An ingest only changes the totals of the user who sent it, so
   detection means working out "who did U just pass today". This needs no stored standings and no cron job.
   `bun:sqlite` is synchronous, so two ingests never interleave.
4. **Live moments only use tokens.** PRs are too coarse for live notifications during the day (1 beats 0), and
   parallelism is an average. Both still win daily titles.
5. **Nothing fires before a race is worth watching.** Just after midnight everyone is at 0, so the first sync
   would "pass" the whole group. Overtakes, #1 changes and "close behind" notifications need the person being
   passed to have at least `RACE_MIN_TOKENS` (1M) today.
6. **Daily results are created lazily.** The first feed or leaderboard read after a group's midnight writes
   yesterday's results. A dedup key keeps it idempotent. There's no scheduler.
7. **Notifications are capped in the helper** at 3 per rolling 24 h, not counting the morning recap. When the cap
   applies, the most important ones win: lost #1 > took #1 > passed you > you passed > close behind. The
   dashboard feed still shows everything.
8. **Chat messages are stored as moments** (`kind = 'chat'`). This reuses the table, the feed endpoint, the
   helper's cursor, the privacy rule and the rename handling. The result is one timeline per group, where a
   message can answer "anna took #1" directly below it.
9. **No currency, collection or shop.** We'll revisit this only if people ask for it.

---

## Phase 0: Foundations

### Schema migrations (`server/src/db/db.ts`)
`schema.sql` says the first schema change should add migrations gated on `PRAGMA user_version`. This feature is
that change.
- [x] `schema.sql` stays as it is (version 0).
- [x] `const MIGRATIONS: string[]` in `db.ts`. Run each entry whose index is `>= user_version` in a transaction,
      then set `user_version`.
- [x] Migration 1 creates the tables below.

```sql
-- Something worth telling people. One row per event; describeMoment() renders it per viewer.
CREATE TABLE moments (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,              -- overtake | climb | take_lead | close_gap | day_title | personal_best | achievement | chat
  actor       TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  target      TEXT REFERENCES users(name) ON DELETE CASCADE,
  group_id    INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,              -- 'YYYY-MM-DD' in the group's (or actor's) timezone
  data        TEXT NOT NULL DEFAULT '{}', -- JSON: numbers and keys only, never names (renames); chat: {text}
  dedup       TEXT UNIQUE,                -- INSERT OR IGNORE makes every detector idempotent; NULL for chat
  created_at  INTEGER NOT NULL
);
CREATE INDEX moments_group ON moments (group_id, id);
CREATE INDEX moments_actor ON moments (actor, id);
CREATE INDEX moments_target ON moments (target, id);

-- Cheap per-user values, so days, streaks and levels never scan all events.
CREATE TABLE user_stats (
  user            TEXT PRIMARY KEY REFERENCES users(name) ON DELETE CASCADE,
  tz              TEXT NOT NULL DEFAULT 'UTC',  -- IANA, sent by the helper
  lifetime_tokens INTEGER NOT NULL DEFAULT 0,
  best_day_tokens INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE TABLE achievements (
  user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user, key)
) WITHOUT ROWID;

-- Backfill lifetime totals and best (UTC) day once.
INSERT INTO user_stats (user, lifetime_tokens, best_day_tokens)
  SELECT user, SUM(t), MAX(t) FROM (
    SELECT user, timestamp / 86400000 AS d,
           SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) AS t
    FROM events WHERE message_type = 'assistant' GROUP BY user, d)
  GROUP BY user;
```
`lifetime_tokens` is `SUM(t)`, the total over all days. Only `best_day_tokens` takes the `MAX`.
- [x] `renameUser` (`server/src/db/users.ts`): add `moments.actor`, `moments.target`, `user_stats.user` and
      `achievements.user` to the tables it rewrites.

### Days (`core/src/range.ts`)
- [x] `dayIn(ms, tz): { key: 'YYYY-MM-DD', since, until }` uses `Intl.DateTimeFormat` to find local midnight.
      Test it across a DST change (Europe/Copenhagen, the last Sunday of March).
- [x] `groupTz(db, groupId)`: the owner's `user_stats.tz`, or `'UTC'` for an owner on an old helper.
- [x] `/leaderboard?range=today&group=G` uses `dayIn(now, groupTz(G))`. Without `group` it keeps using the
      viewer's `tz` offset, as it does now.
- [x] Ingest takes `?tz=<IANA>` (`Intl.DateTimeFormat().resolvedOptions().timeZone` in the helper) and upserts
      `user_stats.tz`. Check it with `Intl.supportedValuesOf("timeZone")` so the value can be trusted.

### Moment types and text (`core/src/moments.ts`, new)
- [x] Add a `Moment` type: `{ id, kind, actor, target, groupId, groupName, day, data, createdAt }`.
- [x] Add `describeMoment(m, viewer): { title, body, notify, priority }`, a pure function used by both the helper and
      the web. The same row reads differently per viewer ("You passed anna" / "bo passed you" / "bo passed anna").
      `notify` is true only when the viewer is the actor or target, or when the kind is group-wide (`day_title`,
      `take_lead`).
- [x] Add a test with one case per kind × perspective. It's a table test and stays small.

### Feed API (`server/src/app.ts`, `server/src/db/moments.ts`, new)
- [x] `GET /api/feed?after=<id>&limit=<n>` returns `{ moments, cursor }`. Without `after` it returns the latest `limit`.
- [x] **Privacy rule (the whole point):** a viewer sees a moment if
      - `group_id` is set and the viewer is a member of that group, or
      - `group_id` is null and both the actor and the target (if any) are in the viewer's `visibleCte`.

      Without the target check, a moment could reveal the name of someone the viewer shares no group with.
      Test that case explicitly.

### Helper → notifications
- [x] `SyncState` (`core/src/types.ts`) gets `feedCursor?: number`, saved with the rest of the state. On the first
      run (no cursor) the helper stores the latest id and sends no notifications, so nobody gets a history dump.
- [x] `Helper.tick()` (`app/helper/src/helper.ts`) calls `/api/feed?after=cursor` after `refreshQuietly()`. For
      each moment where `notify` is true, it applies the cap (by `priority`) and writes a new message:
      `{ event: "notify", title, body }`.
- [x] If more than 2 arrive in one tick, send the most important one plus "…and N more". The cap is kept in
      memory, so a restart resets it, which is fine.
- [x] `core/src/protocol.ts`: add the `notify` variant to `Message`. The contract fixture is regenerated by
      `protocol.test.ts`.

### Swift shell
- [x] `IncomingMessage` gets `title` / `body`. `AppModel.handle` posts `case "notify"` with
      `UNUserNotificationCenter`.
- [x] Ask for notification permission once, when the phase first becomes `.ready`, next to the existing
      launch-at-login default.
- [x] Set a `UNUserNotificationCenterDelegate` whose `willPresent` returns `.banner`. A menu bar app counts as
      frontmost, and without it banners are swallowed.
- [x] In Settings, add a "Leaderboard notifications" toggle (stored in UserDefaults and filtered in the shell;
      the helper doesn't need to know).
- [x] Make `today` the default range in both UIs; it already is in the menu bar. The web dashboard switches from
      `7d` to `today`.

**Done when:** a hand-inserted `moments` row turns into a macOS banner in an `app:dev` build.

---

## Phase 1: The daily race (the core of it)

### Detection on ingest (`server/src/db/moments.ts`, called from the `/ingest` handler)
Run it only when `inserted > 0` and at least one valid event is from the last 24 h. That check is what keeps a new
user's backfill of old history (262k events) from firing anything.

```
for each group G of U with ≥ 2 members:
  day    = dayIn(now, groupTz(G))
  before = dayTotals(G members, day)        // before insertEvents
  ... insertEvents ...
  after  = dayTotals(U, day)
  rank U among G, before vs after (tokens)
  passed = members X that U moved above, with X.tokens ≥ RACE_MIN_TOKENS
  passed.length 1–2  → overtake  (actor U, target X, group G)
  passed.length > 2  → climb     (actor U, group G, data {from, to})
  new rank 1, old #1 X qualifies → take_lead (actor U, target X, group G)
  still behind Y (directly above), gap ≤ 10% of Y, Y ≥ RACE_MIN_TOKENS → close_gap (actor U, target Y)
```
- [x] Group U's groups by timezone, so groups that share a timezone (usually all of them) cost one `before` and one
      `after` query instead of one per group. Export a `dayTotals` wrapper around the private `totalsFor` in
      `stats.ts` instead of copying the SQL.
- [x] Dedup keys (the `day` is part of every one, so the race restarts cleanly at midnight):
      - `overtake:{day}:{U}:{X}`: once per pair per day, so two people trading places don't spam. A shared second
        group dedups for free.
      - `take_lead:{G}:{day}:{U}`
      - `close_gap:{day}:{U}:{Y}`
      - `climb:{G}:{day}:{U}:{to}`
- [x] Cost: two `totalsFor` calls over less than a day per ingest, cheaper than the 20 ms measured for 7d. Mark it
      with `// ponytail: recomputes today's totals per ingest; add a day rollup if big groups make ingest slow`.

### Personal best day
- [x] After insert, if U's tokens today (in U's own timezone) are above `best_day_tokens`, update it and write
      `personal_best` (dedup `pb:{U}:{day}`). That means one notification the first time you beat your record each
      day, not one for every sync after it.

### Morning recap and daily titles
- [x] `ensureDayResults(db, groupIds, now)` runs on `/feed` and `/leaderboard`. For each group without yesterday's
      `day_title` rows, it computes yesterday's group leaderboard and inserts one moment per category winner:
      - 👑 tokens
      - 🐙 parallelism (needs `MIN_ACTIVE_HOURS`, as today)
      - 🚢 PRs (needs ≥ 1)

      Skip groups where fewer than 2 members were active. Dedup key: `day_title:{G}:{day}:{category}`.
- [x] It only looks at yesterday. A day on which no member's app was running during the following day gets no
      titles, which is fine.
- [x] Notification: one per group, rendered from the three rows. Because the rows are created at the first read
      after midnight, it arrives when someone first opens their laptop, which is the right moment.
      Example: "Yesterday in *Arox*: 👑 anna 84M · 🐙 you 3.1× · 🚢 bo 4 PRs".
- [x] `LeaderboardEntry.titles: string[]` holds yesterday's title emoji in the scope being viewed: the one group in
      group view, any of the viewer's groups in "All groups" view. Read it from `moments`, not recomputed.

### Rival gap and "last call" (helper only, no server change)
- [x] `MeStats.above: { name, gap } | null`, taken from the entry ranked just above me in `refresh()`. The entries
      are already there. `MainView.header` shows "1.2M behind **anna**" under the rank.
- [x] Last call: after 21:00 local, if the range is `today`, I'm #2 or #3, and the gap to #1 is at most 20%, the
      helper sends "2.1M behind anna for #1 today. One more session?" once per day. The date of the last one sent
      goes in `SyncState`.

### UI
- [x] Swift `row()` and web `LeaderboardTable` show `titles` after the name.
- [x] Web: a `Feed.tsx` card showing today's moments, polled with `usePoll` and rendered with
      `describeMoment(m, me.name)`.

### Tests (`server/test/moments.test.ts`)
- [x] Setup: A and B are in a group, and A ingests past B. Expect one `overtake`, visible to both, and no
      duplicate when A ingests again the same day.
- [x] Passing someone with less than `RACE_MIN_TOKENS` today produces nothing: the just-after-midnight case.
- [x] C shares a group with A but not with B: C sees neither A's overtake of B nor any mention of B.
- [x] Backfill of old events produces no moments.
- [x] Passing 3 people produces one `climb`, not three overtakes.
- [x] The group day follows the owner's timezone: an event at 23:30 UTC counts as the next day in a
      Europe/Copenhagen group.
- [x] Day results are written once, only for groups with ≥ 2 active members, and `titles` appears on today's
      leaderboard.
- [x] Helper test: moments become `notify` messages, and the cap keeps the highest-priority one. Last call fires
      once.

**Done when:** two local accounts in one group, synced with `helper:once`, produce "X passed you" banners.

---

## Phase 2: Group chat

It's a plain text chat per group, with emoji reactions. The group timeline shows messages mixed with that group's
moments, so a reply sits right under the overtake it's answering. Anything in the timeline can get a reaction: a
message, or an event such as "anna took #1".

**Not included:** threads, edits, images, typing indicators or read receipts.

### Server (`server/src/db/moments.ts`, `server/src/app.ts`)
- [x] `POST /api/groups/:id/messages { text }` checks membership (`isMember`, 404 otherwise, like the other group
      routes). It inserts a `chat` moment with actor = me, `group_id` = G, `data` = `{ text }` and `dedup` = NULL.
- [x] `DELETE /api/feed/:id` deletes a message, only when `kind = 'chat'` and the actor is me. It's there for
      typos and regrets. There's no owner moderation yet: an owner can remove a member, and moderation is SQL on
      the volume, as it is today.
- [x] Validation in `validate.ts`:
      - text is trimmed, 1–500 characters, with control characters removed;
      - rate-limited per user with the existing `RateLimiter`, at 20 messages per minute.
- [x] React and SwiftUI `Text` both escape their output, so no sanitising is needed beyond that.
- [x] Reading uses the existing `/api/feed`, plus a `group=<id>` filter for the timeline of a single group. The
      privacy rule already limits group moments to members, so no new rule is needed.
- [x] Retention: keep everything. Mark it with `// ponytail: chat is never pruned; cap per group if the table grows`.

### Reactions
- [x] Add migration 2 (a separate migration, so Phase 0 can ship without it):

```sql
CREATE TABLE reactions (
  moment_id   INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user        TEXT NOT NULL REFERENCES users(name) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (moment_id, user, emoji)
) WITHOUT ROWID;
```
- [x] **A fixed set of 6 emoji**, in `core/src/moments.ts` as `REACTIONS = ["🔥", "😂", "👑", "💀", "👀", "🫡"]`.
      - Validating means checking the emoji is in the list, so there's no Unicode parsing and nobody can react
        with a 400-character "emoji".
      - The row of 6 is also the whole picker UI.
      - A free-form picker can come later if people ask.
- [x] `POST /api/feed/:id/reactions { emoji }` toggles the reaction: it inserts the row, or deletes it if it's
      already there. It replies with the moment's new reactions.
      - Allowed only if the viewer can see the moment. Reuse the same visibility query as `/api/feed`, and return
        404 otherwise. This is the same rule, not a second copy of it.
      - Rate limit: 60 per minute per user, a separate `RateLimiter` from the one for messages.
- [x] `/api/feed` adds `reactions: { emoji, count, mine }[]` to each moment. It comes from one `GROUP BY moment_id,
      emoji` query over the returned ids, plus `MAX(user = $viewer)` for `mine`.
- [x] `renameUser` also rewrites `reactions.user`.
- [x] Deleting a message removes its reactions through the cascade.
- [x] Reactions don't send notifications and don't count as unread. They're for show, and pinging someone for
      every 🔥 would use up the daily cap.

### Helper
- [x] Commands:
      - `sendMessage { groupId, text }`
      - `deleteMessage { id }`
      - `react { id, emoji }`: toggles the reaction, then patches that item's `reactions` from the reply, so the
        pill updates without waiting for the next poll.
      - `setChatOpen { open, groupId }`: while the chat page is open, the helper re-fetches the group's latest 50
        (`/api/feed?group=G&limit=50`, without a cursor) every 5 s, and stops when the page closes. A re-fetch
        is needed rather than the cursor: a new reaction on an old message doesn't create a new id, so the cursor
        would never pick it up. No websockets.
- [x] `AppState.chat`:
      - `timeline`: the last 50 items for the open group, each with
        `id, author, text, isMe, isSystem, createdAt, reactions`. The helper renders them with `describeMoment`,
        so moments show as system lines.
      - `unread`: the number of chat messages from others with an id above `SyncState.chatReadId`.
- [x] Opening the chat sets `chatReadId`.
- [x] Notifications: a chat message only notifies when it contains `@<my name>`, at priority just below "lost #1".
      Every other message only increases the unread count.

### Swift shell
- [x] Add a new `Page.chat` and a "Chat" button in the `MainView` footer, with an unread badge.
- [x] The chat page uses the group selected in the view. In "All groups" with several groups, it adds a group
      picker on the chat page.
- [x] The chat page is a scrolling list: my messages are right-aligned, and moments are small grey centred lines.
      A `TextField` sends on Return. Right-clicking one of my own messages offers Delete.
- [x] Reactions:
      - Hovering an item shows the row of 6 emoji; clicking one toggles it.
      - Items with reactions show pills underneath (`🔥 3`). My own reactions are highlighted, and clicking a pill
        toggles mine.
      - Moments get the same pills, so "anna took #1" can collect 💀s.
- [x] Menu bar icon: when `unread > 0`, the label gets a dot: `bolt.fill` becomes `bolt.badge.fill` if that
      symbol exists, otherwise a `•` is added.

### Web
- [x] The Phase 1 `Feed.tsx` becomes `Timeline.tsx`. When a group is selected, it shows that group's timeline with
      an input. In "All groups" it shows the merged feed, read-only, with a "pick a group to chat" hint.
- [x] Reaction pills and the hover row work the same as in Swift, and in both views, since reacting doesn't need
      a selected group.
- [x] Use `usePoll` at 5 s for the timeline and 60 s for everything else.

### Tests
- [x] A non-member can't post to or read a group's chat (404). A former member stops seeing it after leaving.
- [x] Deleting only works on my own `chat` rows, never on system moments.
- [x] Text over 500 characters is rejected; the 21st message in a minute returns 429.
- [x] A rename keeps authorship, since `renameUser` rewrites `moments.actor`.
- [x] Reactions:
      - Toggling twice leaves no row, and `count` / `mine` are correct for two users.
      - An emoji outside `REACTIONS` returns 400.
      - Reacting to a moment I can't see returns 404. That includes an overtake in a group I'm not in.
      - Deleting the message removes its reactions.
- [x] Helper test: an `@mention` notifies and a plain message doesn't; `unread` resets after `setChatOpen`.

**Done when:** two local accounts can chat in the menu bar, an overtake shows up in the same list, and a 🔥 from one
account appears on the other within 5 s.

---

## Phase 3: Movement during the day

- [x] Rank arrows: `LeaderboardEntry.delta` is the rank change compared with one hour ago: the same `today`
      range ending at `now − 1h`. It costs one more `totalsFor` per request and is null outside `today`. Show
      ▲2 / ▼1 in both UIs. "In the last hour" is what makes the board feel alive; comparing with yesterday is
      meaningless for a board that resets every day.
- [x] Optional menu bar label: `#2 ▲` next to (or instead of) the token count. The existing "show in menu bar"
      toggle becomes a picker (tokens / rank / both).

---

## Phase 4: Streaks, levels, achievements

The daily results give each person a history of days, so streaks are about winning days, not just showing up.

### Streaks (from `day_title` moments, no event scans)
- [x] **Win streak:** consecutive days holding 👑 in any group. Current streak and best streak go on the user panel;
      reaching 3 days writes `achievement:hat_trick`.
- [x] **Days won** in the last 30 days, shown next to level: "👑 ×7".
- [x] **Active streak:** consecutive local days with at least one assistant event. Recompute at most once per user
      per day by counting distinct local days over the last 100 days. Mark it with
      `// ponytail: 100-day scan once per user per day`.

### Levels
- [x] `insertEvents` adds the tokens of each actually-inserted assistant row (`changes === 1`) to
      `user_stats.lifetime_tokens` in the same transaction.
- [x] `levelFor(tokens)` in `core` works in half-decade steps from 1M, i.e. `floor(2·log10(tokens / 1M)) + 1`:
      1M L1, 10M L3, 100M L5, 1B L7, 10B L9.
      Titles: *Prompt Intern, Context Goblin, Cache Enjoyer, Agent Wrangler, Token Baron, Gigamaxxer, …*
- [x] `/me` and `LeaderboardEntry` get `level`. Reaching a new level writes an `achievement` moment.

### Achievements
Evaluate them on ingest for U only, reusing today's totals from Phase 1. Keep the definitions as one array in
`server/src/db/achievements.ts`: `{ key, emoji, name, check(ctx) }`.

| Key | Rule | Data |
|---|---|---|
| `hat_trick` | won 👑 3 days in a row | `day_title` moments |
| `photo_finish` | won 👑 by less than 2% | `day_title` data |
| `hydra` | 10 agents at once | today `peakAgents` |
| `night_owl` | an assistant event between 02:00 and 05:00 local | inserted batch + `user_stats.tz` |
| `polyglot` | 3 or more sources in one day | today, by source |
| `shipper` | 5 PRs in one day | today `prs` |
| `billionaire` | 1B lifetime tokens | `user_stats` |
| `streak_7` / `streak_30` | active days in a row | active streak |

- [x] `INSERT OR IGNORE INTO achievements` followed by one `achievement` moment (group_id null). A first sync that
      unlocks several at once sends one notification through the helper's "…and N more" collapse.
- [x] UI: level, 👑 count and badges on the user panel (web `UserPanel.tsx`) and in the menu bar header.

---

## Later / only if asked

- **Live "going hard" alerts** ("🔥 mads has had 6 agents running for 2 h"). This shows more than groupmates see
  today, so the subject has to opt in with a server-side flag.
- **Weekly roll-up** ("most days won this week"): a count over `day_title` rows, if people want a longer arc.
- **An efficiency title** (PRs per $) if the token crown turns into a spending contest.
- **A timezone setting** for groups whose members aren't in the owner's timezone.
- **Chat extras:**
  - a free-form emoji picker;
  - "anna reacted 🔥 to your #1" notifications;
  - owner moderation;
  - a websocket if polling every 5 s ever becomes a load problem.
- **Streak freezes, currency or cosmetics:** no, unless people ask.

## Order of work

One PR per phase, each shippable on its own:

- **Phase 0:** no visible change except the dashboard defaulting to Today.
- **Phase 1:** the actual feature.
- **Phase 2:** chat. It depends on Phase 0's feed and helper plumbing. It could ship before Phase 1, but chat is
  more fun when there are overtakes to reply to.
- **Phases 3 and 4:** polish.

Run `bun run check` and `swift test --package-path app/macos` on every PR. CI already checks that the protocol
fixture has no diff.
