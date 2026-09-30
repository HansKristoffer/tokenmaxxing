import { MINUTE_CAP } from "@tokenmaxxing/core/games/tokenmaxxing.ts";
import type { Usage } from "@tokenmaxxing/core/games/types.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import type { IngestResponse, TokenEvent } from "@tokenmaxxing/core/types.ts";
import { actor, UserError } from "rivetkit";
import type { Client } from "rivetkit/client";
import { db } from "rivetkit/db";
import { sha256 } from "../crypto.ts";
import { RateLimiter } from "../rate-limit.ts";
import { AGENT_BUCKET_MS } from "../stats.ts";
import { MAX_EVENTS_PER_REQUEST, parseEvent } from "../validate.ts";
import type { registry } from "./registry.ts";
import {
  type Caller,
  type ConnParams,
  fromInside,
  INTERNAL_KEY,
  main,
  makeToken,
  requireInternal,
  type Sql,
  serial,
  splitToken,
  unauthorized,
} from "./shared.ts";
import type { ActivityDay, UsageDay } from "./town.ts";

const LOGIN_CODE_MS = 2 * 60_000;
const SESSION_MS = 30 * 86_400_000;
const LIVE_AGENTS_MS = 10 * 60_000;
const INSERT_CHUNK = 100;
/** Live login codes and browser sessions kept per player; minting more drops the oldest. */
const MAX_LOGIN_CODES = 5;
const MAX_SESSIONS = 20;
/**
 * Per player: a first sync's backfill still goes through at full speed (1,000 events a request),
 * a script can't fill the volume. Past either, the app's sync fails and resumes on its next run.
 */
const INGESTS_PER_MIN = 60;
const EVENTS_PER_DAY = 500_000;
/**
 * The most tokens a minute counts for, on the leaderboards and for coins: far past any real burst
 * (a busy day is ~1.5B, about 1M a minute), so it only stops made-up numbers. Battles cap harder
 * (`MINUTE_CAP`).
 */
export const USAGE_MINUTE_CAP = 200_000_000;

interface Expiring {
  hash: string;
  expiresAt: number;
}

interface PlayerState {
  userId: number;
  /** Device tokens (the menu bar app), hashed. */
  tokens: string[];
  /** Browser sessions made from login codes. */
  sessions: Expiring[];
  loginCodes: Expiring[];
  /** Events stored on a world day, for `EVENTS_PER_DAY`. Optional: players from before have none. */
  stored?: { day: string; events: number };
}

const COLUMNS = [
  "source",
  "session_id",
  "agent_id",
  "message_id",
  "request_id",
  "timestamp",
  "day",
  "model",
  "message_type",
  "input_tokens",
  "output_tokens",
  "cache_creation_tokens",
  "cache_read_tokens",
  "reasoning_tokens",
];

const eventRow = (e: TokenEvent) => [
  e.source,
  e.sessionId,
  e.agentId,
  e.messageId,
  e.requestId,
  e.timestamp,
  dayKey(e.timestamp),
  e.model,
  e.messageType,
  e.inputTokens,
  e.outputTokens,
  e.cacheCreationTokens,
  e.cacheReadTokens,
  e.reasoningTokens,
];

const live = (list: Expiring[], now: number) => list.filter((e) => e.expiresAt > now);

/** Which kind of credential `secret` is for this player, if any. */
function credential(s: PlayerState, secret: string, now: number): "device" | "session" | null {
  const hash = sha256(secret);
  if (s.tokens.includes(hash)) return "device";
  if (s.sessions.some((x) => x.hash === hash && x.expiresAt > now)) return "session";
  return null;
}

export const player = actor({
  createState: (_c, raw: { userId: number; tokenHash: string; internal: string }): PlayerState => {
    const input = fromInside<{ userId: number; tokenHash: string }>(raw);
    return { userId: input.userId, tokens: [input.tokenHash], sessions: [], loginCodes: [] };
  },
  createVars: () => ({ serial: serial(), ingests: new RateLimiter(INGESTS_PER_MIN, 60_000) }),
  db: db({
    onMigrate: async (d) => {
      await d.execute(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL,
        session_id TEXT NOT NULL,
        agent_id TEXT,
        message_id TEXT NOT NULL,
        request_id TEXT,
        timestamp INTEGER NOT NULL,
        day TEXT NOT NULL,
        model TEXT NOT NULL,
        message_type TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cache_creation_tokens INTEGER NOT NULL,
        cache_read_tokens INTEGER NOT NULL,
        reasoning_tokens INTEGER
      )`);
      // Re-sent events are dropped here; the app relies on it after a crash or reinstall.
      await d.execute(`CREATE UNIQUE INDEX IF NOT EXISTS events_dedup
        ON events (source, message_id, COALESCE(request_id, ''), message_type)`);
      await d.execute("CREATE INDEX IF NOT EXISTS events_day ON events (day, message_type)");
      await d.execute("CREATE INDEX IF NOT EXISTS events_time ON events (timestamp)");
    },
  }),
  createConnState: (c, params: ConnParams): Caller => {
    if (params?.internal === INTERNAL_KEY) return { kind: "internal" };
    if (params?.token === undefined) return { kind: "anonymous" };
    const t = splitToken(params.token);
    const via = t && t.userId === c.state.userId ? credential(c.state, t.secret, Date.now()) : null;
    if (!via) throw unauthorized();
    return { kind: "user", userId: c.state.userId, via };
  },
  actions: {
    /** For other actors checking a token: which credential it is, or null. */
    verify: (c, secret: string): "device" | "session" | null => {
      requireInternal(c.conn.state);
      return credential(c.state, secret, Date.now());
    },

    /** The menu bar app's "Open world": a code the browser trades for a session. */
    mintLoginCode: (c): string => {
      requireDevice(c.conn.state);
      const now = Date.now();
      const { token, hash } = makeToken(c.state.userId);
      c.state.loginCodes = [...live(c.state.loginCodes, now), { hash, expiresAt: now + LOGIN_CODE_MS }].slice(
        -MAX_LOGIN_CODES,
      );
      return token;
    },

    /** Single use. Returns a 30-day browser session token. */
    redeemLoginCode: (c, code: string): string => {
      const now = Date.now();
      const t = splitToken(code);
      const hash = t && t.userId === c.state.userId ? sha256(t.secret) : null;
      const codes = live(c.state.loginCodes, now);
      if (!hash || !codes.some((x) => x.hash === hash))
        throw new UserError("That link has expired. Open the world from the menu bar again.", {
          code: "expired",
        });
      c.state.loginCodes = codes.filter((x) => x.hash !== hash);
      const session = makeToken(c.state.userId);
      c.state.sessions = [
        ...live(c.state.sessions, now),
        { hash: session.hash, expiresAt: now + SESSION_MS },
      ].slice(-MAX_SESSIONS);
      return session.token;
    },

    /** From `town`, when an admin deletes the account: every token and session stops working. */
    close: (c): void => {
      requireInternal(c.conn.state);
      c.destroy();
    },

    /** From `town`, when an admin wipes someone's usage: every raw event goes, and the days they were on. */
    wipe: (c): Promise<string[]> => {
      requireInternal(c.conn.state);
      return c.vars.serial(async () => {
        const days = (await c.db.execute("SELECT DISTINCT day FROM events")) as { day: string }[];
        await c.db.execute("DELETE FROM events");
        return days.map((d) => d.day);
      });
    },

    /** A usage game's score (Tokenmaxxing). */
    tokensBetween: (c, from: number, to: number): Promise<Usage> => {
      requireInternal(c.conn.state);
      return tokensBetween(c.db, from, to);
    },

    ingest: (c, events: unknown): Promise<IngestResponse & { skipped: number }> => {
      requireDevice(c.conn.state);
      if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_REQUEST)
        throw new UserError("Too many events.", { code: "invalid_body" });
      const now = Date.now();
      if (!c.vars.ingests.take("sync", now))
        throw new UserError("Syncing too often. Try again in a minute.", { code: "rate_limited" });
      const valid: TokenEvent[] = [];
      for (const raw of events) {
        const e = parseEvent(raw, now);
        if (typeof e !== "string") valid.push(e);
      }
      return c.vars.serial(async () => {
        const today = dayKey(now);
        const stored = c.state.stored?.day === today ? c.state.stored.events : 0;
        if (stored >= EVENTS_PER_DAY)
          throw new UserError("That's a lot of events for one day. The rest syncs tomorrow.", {
            code: "rate_limited",
          });
        const [{ before }] = (await c.db.execute("SELECT total_changes() AS before")) as [{ before: number }];
        for (let i = 0; i < valid.length; i += INSERT_CHUNK) {
          const chunk = valid.slice(i, i + INSERT_CHUNK);
          const row = `(${COLUMNS.map(() => "?").join(",")})`;
          await c.db.execute(
            `INSERT OR IGNORE INTO events (${COLUMNS.join(",")}) VALUES ${chunk.map(() => row).join(",")}`,
            ...chunk.flatMap(eventRow),
          );
        }
        const [{ after }] = (await c.db.execute("SELECT total_changes() AS after")) as [{ after: number }];
        const inserted = after - before;
        c.state.stored = { day: today, events: stored + inserted };
        if (inserted > 0) {
          const days = [...new Set(valid.map((e) => dayKey(e.timestamp)))];
          await report(c.db, c.client<typeof registry>(), c.state.userId, days, now);
          // In a battle? It pulls the new score from us.
          await main(c.client())
            .arcade.usage(c.state.userId)
            .catch(() => {});
        }
        return { inserted, duplicates: valid.length - inserted, skipped: events.length - valid.length };
      });
    },
  },
});

const EVENT_TOKENS = "input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens";

/** Tokens in assistant events stamped from ≤ t < to, the same sum as the leaderboard, each minute capped (and flagged). */
export async function tokensBetween(sql: Sql, from: number, to: number): Promise<Usage> {
  const [r] = (await sql.execute(
    `SELECT COALESCE(SUM(MIN(t, ?)), 0) AS tokens, COALESCE(MAX(t > ?), 0) AS flagged FROM (
       SELECT SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) AS t
       FROM events WHERE message_type = 'assistant' AND timestamp >= ? AND timestamp < ?
       GROUP BY timestamp / 60000)`,
    MINUTE_CAP,
    MINUTE_CAP,
    from,
    to,
  )) as [{ tokens: number; flagged: number }];
  return { tokens: r.tokens, flagged: r.flagged === 1 };
}

function requireDevice(caller: Caller): void {
  if (caller.kind !== "user" || caller.via !== "device") throw unauthorized();
}

/** Recomputes `days` from raw events and hands them to `town`, then tells `world` how busy we are. */
async function report(
  sql: Sql,
  client: Client<typeof registry>,
  userId: number,
  days: string[],
  now: number,
): Promise<void> {
  const inDays = `day IN (${days.map(() => "?").join(",")})`;
  // Each minute counts up to USAGE_MINUTE_CAP tokens: past it, that minute's events are scaled
  // down, and what didn't count is kept per day (`capped`) for the admin page to flag.
  const minutes = `SELECT timestamp / 60000 AS minute, SUM(${EVENT_TOKENS}) AS t
     FROM events WHERE ${inDays} AND message_type = 'assistant' GROUP BY minute`;
  const scaled = (col: string) =>
    `CAST(SUM(${col} * CASE WHEN m.t > ? THEN ? * 1.0 / m.t ELSE 1 END) AS INTEGER)`;
  const usage = (await sql.execute(
    `WITH m AS (${minutes})
     SELECT day, model, ${scaled("input_tokens")} AS input, ${scaled("output_tokens")} AS output,
            ${scaled("cache_creation_tokens")} AS cacheCreation, ${scaled("cache_read_tokens")} AS cacheRead,
            COUNT(*) AS turns
     FROM events JOIN m ON m.minute = timestamp / 60000
     WHERE ${inDays} AND message_type = 'assistant'
     GROUP BY day, model`,
    ...days,
    ...Array(4).fill([USAGE_MINUTE_CAP, USAGE_MINUTE_CAP]).flat(),
    ...days,
  )) as UsageDay[];
  const capped = (await sql.execute(
    `SELECT day, SUM(t - ?) AS tokens FROM (
       SELECT day, SUM(${EVENT_TOKENS}) AS t FROM events
       WHERE ${inDays} AND message_type = 'assistant' GROUP BY day, timestamp / 60000)
     WHERE t > ? GROUP BY day`,
    USAGE_MINUTE_CAP,
    ...days,
    USAGE_MINUTE_CAP,
  )) as { day: string; tokens: number }[];
  const counts = (await sql.execute(
    `SELECT day, SUM(message_type = 'user') AS prompts, SUM(message_type = 'pr') AS prs
     FROM events WHERE ${inDays} GROUP BY day`,
    ...days,
  )) as { day: string; prompts: number; prs: number }[];
  // ponytail: 5-minute buckets. Two sessions inside one bucket count as 2, and a
  // silent tool call over 5 min drops out. Merge activity intervals if people compare decimals.
  const buckets = (await sql.execute(
    `WITH b AS (
       SELECT day, timestamp / ? AS bucket,
              COUNT(DISTINCT session_id || ':' || COALESCE(agent_id, '')) AS agents
       FROM events WHERE ${inDays} AND message_type = 'assistant'
       GROUP BY day, bucket)
     SELECT day, SUM(agents) AS agentBuckets, COUNT(*) AS activeBuckets, MAX(agents) AS peakAgents
     FROM b GROUP BY day`,
    AGENT_BUCKET_MS,
    ...days,
  )) as { day: string; agentBuckets: number; activeBuckets: number; peakAgents: number }[];
  const activity: ActivityDay[] = days.map((day) => {
    const n = counts.find((r) => r.day === day);
    const b = buckets.find((r) => r.day === day);
    return {
      day,
      prompts: n?.prompts ?? 0,
      prs: n?.prs ?? 0,
      agentBuckets: b?.agentBuckets ?? 0,
      activeBuckets: b?.activeBuckets ?? 0,
      peakAgents: b?.peakAgents ?? 0,
      capped: capped.find((r) => r.day === day)?.tokens ?? 0,
    };
  });
  await main(client).town.report(userId, days, usage, activity);

  const [recent] = (await sql.execute(
    `SELECT MAX(timestamp) AS lastAt,
            COUNT(DISTINCT CASE WHEN timestamp > ? THEN session_id || ':' || COALESCE(agent_id, '') END) AS agents
     FROM events WHERE message_type = 'assistant'`,
    now - LIVE_AGENTS_MS,
  )) as [{ lastAt: number | null; agents: number }];
  if (recent.lastAt !== null) await main(client).world.activity(userId, recent.lastAt, recent.agents);
}
