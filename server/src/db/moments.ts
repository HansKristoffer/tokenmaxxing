import {
  ACHIEVEMENTS,
  type AchievementKey,
  levelFor,
  type Moment,
  type MomentKind,
  RACE_MIN_TOKENS,
  REACTIONS,
  type Reaction,
  TITLE_EMOJI,
  type TitleCategory,
} from "@tokenmaxxing/core/moments.ts";
import { addDays, DAY_MS, type Day, dayBefore, dayIn, hourIn, tzOffset } from "@tokenmaxxing/core/range.ts";
import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { PricingCache } from "../pricing.ts";
import type { Db } from "./db.ts";
import { listMembers } from "./groups.ts";
import { type Scope, totalsForUsers, type UsageTotals, visibleCte } from "./stats.ts";

// ---------------------------------------------------------------------------
// Timezones

export const userTz = (db: Db, user: string): string =>
  db.query<{ tz: string }, { user: string }>("SELECT tz FROM user_stats WHERE user = $user").get({ user })
    ?.tz ?? "UTC";

export function setUserTz(db: Db, user: string, tz: string): void {
  db.query(
    `INSERT INTO user_stats (user, tz) VALUES ($user, $tz)
     ON CONFLICT (user) DO UPDATE SET tz = $tz WHERE tz != $tz`,
  ).run({ user, tz });
}

/** A group races on its owner's clock. */
export const groupTz = (db: Db, groupId: number): string =>
  db
    .query<{ tz: string | null }, { groupId: number }>(
      "SELECT s.tz FROM groups g LEFT JOIN user_stats s ON s.user = g.owner WHERE g.id = $groupId",
    )
    .get({ groupId })?.tz ?? "UTC";

// ---------------------------------------------------------------------------
// Writing moments

interface NewMoment {
  kind: MomentKind;
  actor: string;
  target?: string | null;
  groupId?: number | null;
  day: string;
  data?: Record<string, unknown>;
  /** Unique key; a second insert with the same key is a no-op. Null for chat. */
  dedup: string | null;
}

/** Returns the new id, or null when `dedup` already exists. */
export function insertMoment(db: Db, m: NewMoment, now: number): number | null {
  const row = db
    .query<{ id: number }, Record<string, string | number | null>>(
      `INSERT OR IGNORE INTO moments (kind, actor, target, group_id, day, data, dedup, created_at)
       VALUES ($kind, $actor, $target, $groupId, $day, $data, $dedup, $now) RETURNING id`,
    )
    .get({
      kind: m.kind,
      actor: m.actor,
      target: m.target ?? null,
      groupId: m.groupId ?? null,
      day: m.day,
      data: JSON.stringify(m.data ?? {}),
      dedup: m.dedup,
      now,
    });
  return row?.id ?? null;
}

function unlock(db: Db, user: string, key: AchievementKey, day: string, now: number): void {
  const r = db
    .query("INSERT OR IGNORE INTO achievements (user, key, unlocked_at) VALUES ($user, $key, $now)")
    .run({ user, key, now });
  if (r.changes)
    insertMoment(
      db,
      { kind: "achievement", actor: user, day, data: { key }, dedup: `ach:${user}:${key}` },
      now,
    );
}

// ---------------------------------------------------------------------------
// The daily race: detected per ingest. Only the user who synced changed, so
// the question is just "who did they pass today".

interface RaceGroup {
  id: number;
  tz: string;
  members: string[];
}

export interface RaceSnapshot {
  groups: RaceGroup[];
  /** Per group timezone: that day, and everyone's totals before the insert. */
  days: Map<string, { day: Day; before: Map<string, UsageTotals> }>;
  lifetime: number;
}

/** Everyone's standing today in each of `user`'s groups, taken before their events are inserted. */
export function raceSnapshot(db: Db, pricing: PricingCache, user: string, now: number): RaceSnapshot {
  const rows = db
    .query<{ id: number; tz: string | null; member: string }, { user: string }>(
      `SELECT g.id, s.tz, m2.user AS member
       FROM group_members m
       JOIN groups g ON g.id = m.group_id
       JOIN group_members m2 ON m2.group_id = g.id
       LEFT JOIN user_stats s ON s.user = g.owner
       WHERE m.user = $user`,
    )
    .all({ user });
  const byId = new Map<number, RaceGroup>();
  for (const r of rows) {
    const g = byId.get(r.id) ?? { id: r.id, tz: r.tz ?? "UTC", members: [] };
    g.members.push(r.member);
    byId.set(r.id, g);
  }
  const groups = [...byId.values()].filter((g) => g.members.length >= 2);
  // Groups sharing a timezone (usually all of them) share one query.
  const days: RaceSnapshot["days"] = new Map();
  for (const tz of new Set(groups.map((g) => g.tz))) {
    const members = new Set(groups.filter((g) => g.tz === tz).flatMap((g) => g.members));
    const day = dayIn(now, tz);
    days.set(tz, { day, before: totalsForUsers(db, pricing, [...members], day) });
  }
  const lifetime =
    db
      .query<{ t: number }, { user: string }>(
        "SELECT lifetime_tokens AS t FROM user_stats WHERE user = $user",
      )
      .get({ user })?.t ?? 0;
  return { groups, days, lifetime };
}

/** Anything with an assistant turn in the last day is worth a snapshot; old backfill isn't. */
export const isRecentBatch = (events: readonly TokenEvent[], now: number): boolean =>
  events.some((e) => e.messageType === "assistant" && e.timestamp >= now - DAY_MS);

// ponytail: recomputes today's totals per ingest (two queries per timezone);
// add a day rollup if big groups make ingest slow.
export function detectMoments(
  db: Db,
  pricing: PricingCache,
  user: string,
  snap: RaceSnapshot,
  batch: readonly TokenEvent[],
  now: number,
): void {
  db.transaction(() => {
    for (const [tz, { day, before }] of snap.days) {
      const beforeU = before.get(user)?.tokens ?? 0;
      const afterU = totalsForUsers(db, pricing, [user], day).get(user)?.tokens ?? 0;
      if (afterU <= beforeU) continue;
      for (const g of snap.groups.filter((g) => g.tz === tz)) {
        raceMoments(db, user, g, day.key, before, beforeU, afterU, now);
      }
    }
    personalMoments(db, pricing, user, snap.lifetime, batch, now);
  })();
}

function raceMoments(
  db: Db,
  user: string,
  g: RaceGroup,
  day: string,
  before: Map<string, UsageTotals>,
  beforeU: number,
  afterU: number,
  now: number,
): void {
  const others = g.members
    .filter((n) => n !== user)
    .map((name) => ({ name, tokens: before.get(name)?.tokens ?? 0 }));
  const rankOf = (v: number) => 1 + others.filter((o) => o.tokens > v).length;
  const from = rankOf(beforeU);
  const to = rankOf(afterU);
  const base = { actor: user, groupId: g.id, day };

  const passed = others.filter(
    (o) => o.tokens >= beforeU && o.tokens < afterU && o.tokens >= RACE_MIN_TOKENS,
  );
  const leader = others.reduce((a, b) => (b.tokens > a.tokens ? b : a), others[0]!);
  const tookLead = to === 1 && from > 1 && leader.tokens >= RACE_MIN_TOKENS;
  if (tookLead) {
    insertMoment(
      db,
      {
        ...base,
        kind: "take_lead",
        target: leader.name,
        data: { tokens: afterU },
        dedup: `take_lead:${g.id}:${day}:${user}`,
      },
      now,
    );
  }
  if (passed.length > 2) {
    insertMoment(
      db,
      {
        ...base,
        kind: "climb",
        data: { from, to, tokens: afterU },
        dedup: `climb:${g.id}:${day}:${user}:${to}`,
      },
      now,
    );
  } else {
    for (const o of passed) {
      if (tookLead && o.name === leader.name) continue;
      insertMoment(
        db,
        {
          ...base,
          kind: "overtake",
          target: o.name,
          data: { rank: to, tokens: afterU },
          dedup: `overtake:${day}:${user}:${o.name}`,
        },
        now,
      );
    }
  }

  const above = others.filter((o) => o.tokens > afterU).sort((a, b) => a.tokens - b.tokens)[0];
  if (above && above.tokens >= RACE_MIN_TOKENS && above.tokens - afterU <= above.tokens * 0.1) {
    insertMoment(
      db,
      {
        ...base,
        kind: "close_gap",
        target: above.name,
        data: { gap: above.tokens - afterU, rank: to - 1 },
        dedup: `close_gap:${day}:${user}:${above.name}`,
      },
      now,
    );
  }
}

/** Personal best, streaks, levels and achievements, all in the user's own timezone. */
function personalMoments(
  db: Db,
  pricing: PricingCache,
  user: string,
  lifetimeBefore: number,
  batch: readonly TokenEvent[],
  now: number,
): void {
  const tz = userTz(db, user);
  const day = dayIn(now, tz);
  const today = totalsForUsers(db, pricing, [user], day).get(user)!;
  const s = refreshDaily(db, user, tz, day, now);

  const createdAt = db
    .query<{ c: number }, { user: string }>("SELECT created_at AS c FROM users WHERE name = $user")
    .get({ user })!.c;
  // On signup day the history is still arriving, so "best day" isn't known yet.
  if (s.bestDay > 0 && today.tokens > s.bestDay && now - createdAt > DAY_MS) {
    insertMoment(
      db,
      {
        kind: "personal_best",
        actor: user,
        day: day.key,
        data: { tokens: today.tokens },
        dedup: `pb:${user}:${day.key}`,
      },
      now,
    );
  }

  const lvl = levelFor(s.lifetime).level;
  if (lvl > levelFor(lifetimeBefore).level) {
    insertMoment(
      db,
      {
        kind: "achievement",
        actor: user,
        day: day.key,
        data: { key: "level", level: lvl },
        dedup: `level:${user}:${lvl}`,
      },
      now,
    );
  }

  const earned: AchievementKey[] = [];
  if (today.peakAgents >= 10) earned.push("hydra");
  if (today.prs >= 5) earned.push("shipper");
  if (s.lifetime >= 1e9) earned.push("billionaire");
  if (s.streak >= 7) earned.push("streak_7");
  if (s.streak >= 30) earned.push("streak_30");
  if (
    batch.some(
      (e) => e.messageType === "assistant" && hourIn(e.timestamp, tz) >= 2 && hourIn(e.timestamp, tz) < 5,
    )
  )
    earned.push("night_owl");
  const sources = db
    .query<{ n: number }, { user: string; since: number; until: number }>(
      `SELECT COUNT(DISTINCT source) AS n FROM events
       WHERE user = $user AND timestamp >= $since AND timestamp < $until AND message_type = 'assistant'`,
    )
    .get({ user, since: day.since, until: day.until })!.n;
  if (sources >= 3) earned.push("polyglot");
  for (const key of earned) unlock(db, user, key, day.key, now);
}

/**
 * Best earlier day and the active streak, recomputed at most once per user per
 * local day from one pass over their daily totals.
 * ponytail: scans the user's whole history once a day; keep a daily rollup if that gets slow.
 */
function refreshDaily(
  db: Db,
  user: string,
  tz: string,
  day: Day,
  now: number,
): { bestDay: number; streak: number; lifetime: number } {
  const row = db
    .query<{ best: number; streak: number; streakDay: string | null; lifetime: number }, { user: string }>(
      `SELECT best_day_tokens AS best, streak_days AS streak, streak_day AS streakDay, lifetime_tokens AS lifetime
       FROM user_stats WHERE user = $user`,
    )
    .get({ user }) ?? { best: 0, streak: 0, streakDay: null, lifetime: 0 };
  if (row.streakDay === day.key) return { bestDay: row.best, streak: row.streak, lifetime: row.lifetime };

  // Day numbers shifted by today's offset; off by an hour around DST changes, which is fine for this.
  const shift = tzOffset(now, tz);
  const days = db
    .query<{ d: number; t: number }, { user: string; shift: number; until: number; dayMs: number }>(
      `SELECT (timestamp + $shift) / $dayMs AS d,
              SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) AS t
       FROM events WHERE user = $user AND message_type = 'assistant' AND timestamp < $until
       GROUP BY d`,
    )
    .all({ user, shift, until: day.since, dayMs: DAY_MS });
  const best = days.reduce((m, r) => Math.max(m, r.t), 0);
  const active = new Set(days.map((r) => r.d));
  let streak = 1; // today counts: we only get here from a batch with a recent assistant turn
  for (let d = Math.floor((day.since + shift) / DAY_MS) - 1; active.has(d); d--) streak++;
  db.query(
    `INSERT INTO user_stats (user, best_day_tokens, streak_days, streak_day) VALUES ($user, $best, $streak, $key)
     ON CONFLICT (user) DO UPDATE SET best_day_tokens = $best, streak_days = $streak, streak_day = $key`,
  ).run({ user, best, streak, key: day.key });
  return { bestDay: best, streak, lifetime: row.lifetime };
}

// ---------------------------------------------------------------------------
// Daily results: written lazily by the first read after a group's midnight.

const CATEGORIES: { key: TitleCategory; value: (t: UsageTotals) => number | null }[] = [
  { key: "tokens", value: (t) => (t.tokens > 0 ? t.tokens : null) },
  { key: "parallelism", value: (t) => t.parallelism },
  { key: "prs", value: (t) => (t.prs > 0 ? t.prs : null) },
];

/**
 * Writes yesterday's titles for each group once. `done` remembers what this
 * process already checked, so polling reads don't recompute; after a restart
 * the dedup keys make a second run a no-op.
 */
export function ensureDayResults(
  db: Db,
  pricing: PricingCache,
  groupIds: readonly number[],
  now: number,
  done: Set<string>,
): void {
  for (const groupId of groupIds) {
    const tz = groupTz(db, groupId);
    const y = dayBefore(dayIn(now, tz), tz);
    const key = `${groupId}:${y.key}`;
    if (done.has(key)) continue;
    done.add(key);
    const members = listMembers(db, groupId).map((m) => m.user);
    const totals = [...totalsForUsers(db, pricing, members, y)];
    if (totals.filter(([, t]) => t.tokens > 0).length < 2) continue;
    db.transaction(() => {
      for (const c of CATEGORIES) {
        const ranked = totals
          .map(([name, t]) => ({ name, v: c.value(t) }))
          .filter((r): r is { name: string; v: number } => r.v !== null)
          .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));
        const [win, second] = ranked;
        if (!win) continue;
        const id = insertMoment(
          db,
          {
            kind: "day_title",
            actor: win.name,
            groupId,
            day: y.key,
            data: { category: c.key, value: win.v, second: second?.v ?? 0 },
            dedup: `day_title:${groupId}:${y.key}:${c.key}`,
          },
          now,
        );
        if (id === null || c.key !== "tokens") continue;
        if (second && (win.v - second.v) / win.v < 0.02) unlock(db, win.name, "photo_finish", y.key, now);
        const won = new Set(tokenWins(db, win.name));
        if (won.has(addDays(y.key, -1)) && won.has(addDays(y.key, -2)))
          unlock(db, win.name, "hat_trick", y.key, now);
      }
    })();
  }
}

/** Days `user` won 👑 in any group, newest first. */
const tokenWins = (db: Db, user: string): string[] =>
  db
    .query<{ day: string }, { user: string }>(
      `SELECT DISTINCT day FROM moments
       WHERE actor = $user AND kind = 'day_title' AND json_extract(data, '$.category') = 'tokens'
       ORDER BY day DESC`,
    )
    .all({ user })
    .map((r) => r.day);

/** Yesterday's title emoji per user, for the given groups. */
export function titlesFor(db: Db, groupIds: readonly number[], now: number): Map<string, string[]> {
  const out = new Map<string, Set<TitleCategory>>();
  for (const groupId of groupIds) {
    const tz = groupTz(db, groupId);
    const y = dayBefore(dayIn(now, tz), tz);
    for (const r of db
      .query<{ actor: string; category: TitleCategory }, { groupId: number; day: string }>(
        `SELECT actor, json_extract(data, '$.category') AS category FROM moments
         WHERE group_id = $groupId AND kind = 'day_title' AND day = $day`,
      )
      .all({ groupId, day: y.key })) {
      out.set(r.actor, (out.get(r.actor) ?? new Set()).add(r.category));
    }
  }
  const order: TitleCategory[] = ["tokens", "parallelism", "prs"];
  return new Map(
    [...out].map(([user, cats]) => [user, order.filter((c) => cats.has(c)).map((c) => TITLE_EMOJI[c])]),
  );
}

export const levelsFor = (db: Db, users: readonly string[]): Map<string, number> =>
  new Map(
    db
      .query<{ user: string; t: number }, { users: string }>(
        "SELECT user, lifetime_tokens AS t FROM user_stats WHERE user IN (SELECT value FROM json_each($users))",
      )
      .all({ users: JSON.stringify(users) })
      .map((r) => [r.user, levelFor(r.t).level]),
  );

export interface Progress {
  lifetimeTokens: number;
  level: number;
  levelTitle: string;
  daysWon30: number;
  winStreak: number;
  bestWinStreak: number;
  activeStreak: number;
  achievements: { key: AchievementKey; emoji: string; name: string; desc: string; unlockedAt: number }[];
}

export function progressOf(db: Db, user: string, now: number): Progress {
  const s = db
    .query<{ lifetime: number; tz: string; streak: number; streakDay: string | null }, { user: string }>(
      `SELECT lifetime_tokens AS lifetime, tz, streak_days AS streak, streak_day AS streakDay
       FROM user_stats WHERE user = $user`,
    )
    .get({ user }) ?? { lifetime: 0, tz: "UTC", streak: 0, streakDay: null };
  const today = dayIn(now, s.tz).key;
  const yesterday = addDays(today, -1);

  const wins = tokenWins(db, user);
  let winStreak = 0;
  // Titles exist up to yesterday (a group in another timezone may be a day behind).
  if (wins[0] && wins[0] >= addDays(yesterday, -1)) {
    for (let d = wins[0]; wins.includes(d); d = addDays(d, -1)) winStreak++;
  }
  let bestWinStreak = 0;
  let run = 0;
  for (let i = 0; i < wins.length; i++) {
    run = i > 0 && addDays(wins[i - 1]!, -1) === wins[i] ? run + 1 : 1;
    bestWinStreak = Math.max(bestWinStreak, run);
  }

  const { level, title } = levelFor(s.lifetime);
  return {
    lifetimeTokens: s.lifetime,
    level,
    levelTitle: title,
    daysWon30: wins.filter((d) => d > addDays(today, -30)).length,
    winStreak,
    bestWinStreak,
    activeStreak: s.streakDay === today || s.streakDay === yesterday ? s.streak : 0,
    achievements: db
      .query<{ key: AchievementKey; unlockedAt: number }, { user: string }>(
        "SELECT key, unlocked_at AS unlockedAt FROM achievements WHERE user = $user ORDER BY unlocked_at",
      )
      .all({ user })
      .filter((a) => a.key in ACHIEVEMENTS)
      .map((a) => ({ ...a, ...ACHIEVEMENTS[a.key] })),
  };
}

// ---------------------------------------------------------------------------
// The feed: every moment the viewer may see. Same rule for reading, reacting
// and notifications.

interface MomentRow {
  id: number;
  kind: MomentKind;
  actor: string;
  target: string | null;
  groupId: number | null;
  groupName: string | null;
  day: string;
  data: string;
  createdAt: number;
}

/**
 * A group moment is visible to the group's members. A moment without a group
 * is visible when its actor and its target (if any) both share a group with
 * the viewer; checking the target too keeps strangers' names out of the feed.
 */
function visibleMomentsSql(viewer: string) {
  const cte = visibleCte({ viewer, groupId: null } satisfies Scope);
  return {
    sql: `${cte.sql}
      SELECT m.id, m.kind, m.actor, m.target, m.group_id AS groupId, g.name AS groupName, m.day, m.data,
             m.created_at AS createdAt
      FROM moments m LEFT JOIN groups g ON g.id = m.group_id
      WHERE (
        (m.group_id IS NOT NULL
          AND m.group_id IN (SELECT group_id FROM group_members WHERE user = $viewer))
        OR (m.group_id IS NULL AND m.actor IN (SELECT user FROM visible)
          AND (m.target IS NULL OR m.target IN (SELECT user FROM visible)))
      )`,
    params: { ...cte.params, viewer },
  };
}

export interface FeedQuery {
  after?: number;
  groupId?: number | null;
  limit: number;
  id?: number;
}

/** The newest `limit` visible moments after `after`, oldest first. */
export function listFeed(db: Db, viewer: string, q: FeedQuery): Moment[] {
  const v = visibleMomentsSql(viewer);
  const rows = db
    .query<MomentRow, Record<string, string | number | null>>(
      `${v.sql} AND m.id > $after AND ($groupId IS NULL OR m.group_id = $groupId) AND ($id IS NULL OR m.id = $id)
       ORDER BY m.id DESC LIMIT $limit`,
    )
    .all({ ...v.params, after: q.after ?? 0, groupId: q.groupId ?? null, id: q.id ?? null, limit: q.limit })
    .reverse();
  const reactions = reactionsFor(
    db,
    viewer,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, data: JSON.parse(r.data), reactions: reactions.get(r.id) ?? [] }));
}

export const canSeeMoment = (db: Db, viewer: string, id: number): boolean =>
  listFeed(db, viewer, { id, limit: 1 }).length === 1;

function reactionsFor(db: Db, viewer: string, ids: readonly number[]): Map<number, Reaction[]> {
  const out = new Map<number, Reaction[]>();
  if (ids.length === 0) return out;
  const rows = db
    .query<{ id: number; emoji: string; count: number; mine: number }, { ids: string; viewer: string }>(
      `SELECT moment_id AS id, emoji, COUNT(*) AS count, MAX(user = $viewer) AS mine FROM reactions
       WHERE moment_id IN (SELECT value FROM json_each($ids)) GROUP BY moment_id, emoji`,
    )
    .all({ ids: JSON.stringify(ids), viewer });
  for (const r of rows.sort(
    (a, b) => REACTIONS.indexOf(a.emoji as never) - REACTIONS.indexOf(b.emoji as never),
  )) {
    const list = out.get(r.id) ?? [];
    list.push({ emoji: r.emoji, count: r.count, mine: r.mine === 1 });
    out.set(r.id, list);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chat and reactions

// ponytail: chat is never pruned; cap per group if the table grows.
export function postMessage(db: Db, user: string, groupId: number, text: string, now: number): Moment {
  const id = insertMoment(
    db,
    {
      kind: "chat",
      actor: user,
      groupId,
      day: dayIn(now, groupTz(db, groupId)).key,
      data: { text },
      dedup: null,
    },
    now,
  )!;
  return listFeed(db, user, { id, limit: 1 })[0]!;
}

/** Only my own chat messages; returns false for anything else. */
export const deleteMessage = (db: Db, user: string, id: number): boolean =>
  db.query("DELETE FROM moments WHERE id = $id AND kind = 'chat' AND actor = $user").run({ id, user })
    .changes === 1;

/** Adds my reaction, or removes it if it's there. Caller checks visibility. */
export function toggleReaction(db: Db, user: string, id: number, emoji: string, now: number): Reaction[] {
  const removed = db
    .query("DELETE FROM reactions WHERE moment_id = $id AND user = $user AND emoji = $emoji")
    .run({ id, user, emoji }).changes;
  if (!removed) {
    db.query(
      "INSERT INTO reactions (moment_id, user, emoji, created_at) VALUES ($id, $user, $emoji, $now)",
    ).run({ id, user, emoji, now });
  }
  return reactionsFor(db, user, [id]).get(id) ?? [];
}
