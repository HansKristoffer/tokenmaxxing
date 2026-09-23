import type { SortKey } from "@tokenmaxxing/core/protocol.ts";
import { DAY_MS, type Range } from "@tokenmaxxing/core/range.ts";
import { computeRowCostUsd, type PricingCache, roundUsd } from "../pricing.ts";
import type { Db } from "./db.ts";

/**
 * Who the viewer may see: themselves plus everyone sharing a group with them,
 * or the members of one group. Every stats query goes through this — it is
 * the privacy rule. `groupId` must already be checked for membership.
 */
export interface Scope {
  viewer: string;
  groupId: number | null;
}

function visibleCte(scope: Scope): { sql: string; params: Record<string, string | number> } {
  if (scope.groupId !== null) {
    return {
      sql: "WITH visible(user) AS (SELECT user FROM group_members WHERE group_id = $groupId)",
      params: { groupId: scope.groupId },
    };
  }
  return {
    sql: `WITH visible(user) AS (
            SELECT $viewer
            UNION
            SELECT m2.user FROM group_members m1
            JOIN group_members m2 ON m2.group_id = m1.group_id
            WHERE m1.user = $viewer)`,
    params: { viewer: scope.viewer },
  };
}

export function visibleUsers(db: Db, scope: Scope): string[] {
  const { sql, params } = visibleCte(scope);
  return db
    .query<{ user: string }, Record<string, string | number>>(`${sql} SELECT user FROM visible`)
    .all(params)
    .map((r) => r.user);
}

export const canSee = (db: Db, viewer: string, user: string): boolean =>
  visibleUsers(db, { viewer, groupId: null }).includes(user);

/** Parallelism resolution. See PLAN.md "New stat: Parallelism". */
export const AGENT_BUCKET_MS = 5 * 60_000;
/** Below this, parallelism is null so one short burst can't top the board. */
export const MIN_ACTIVE_HOURS = 1;

export interface UsageTotals {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  /** Assistant turns. */
  turns: number;
  /** Human prompts. */
  prompts: number;
  /** Average number of agents running at once while any was running. */
  parallelism: number | null;
  peakAgents: number;
  activeHours: number;
  tokensPerActiveHour: number | null;
  lastActiveAt: number | null;
  topModel: string | null;
}

export interface LeaderboardEntry extends UsageTotals {
  name: string;
  rank: number;
}

interface ModelSumRow {
  user: string;
  model: string;
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  turns: number;
  lastActiveAt: number;
}

const emptyTotals = (): UsageTotals => ({
  tokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
  turns: 0,
  prompts: 0,
  parallelism: null,
  peakAgents: 0,
  activeHours: 0,
  tokensPerActiveHour: null,
  lastActiveAt: null,
  topModel: null,
});

const rowTokens = (r: Pick<ModelSumRow, "input" | "output" | "cacheCreation" | "cacheRead">) =>
  r.input + r.output + r.cacheCreation + r.cacheRead;

const rowCost = (pricing: PricingCache, r: ModelSumRow) => {
  const price = pricing.lookup(r.model);
  return price ? computeRowCostUsd(r, price) : 0;
};

/** Totals for every user in `users` (a CTE body yielding a `user` column). */
function totalsFor(
  db: Db,
  pricing: PricingCache,
  cte: { sql: string; params: Record<string, string | number> },
  range: Range,
): Map<string, UsageTotals> {
  const params = { ...cte.params, since: range.since, until: range.until };
  const window = "e.timestamp >= $since AND e.timestamp < $until";
  const out = new Map<string, UsageTotals>();
  for (const { user } of db
    .query<{ user: string }, typeof params>(`${cte.sql} SELECT user FROM visible`)
    .all(params)) {
    out.set(user, emptyTotals());
  }

  const modelRows = db
    .query<ModelSumRow, typeof params>(
      `${cte.sql}
       SELECT e.user, e.model,
              SUM(e.input_tokens) AS input, SUM(e.output_tokens) AS output,
              SUM(e.cache_creation_tokens) AS cacheCreation, SUM(e.cache_read_tokens) AS cacheRead,
              COUNT(*) AS turns, MAX(e.timestamp) AS lastActiveAt
       FROM events e
       WHERE e.user IN (SELECT user FROM visible) AND ${window} AND e.message_type = 'assistant'
       GROUP BY e.user, e.model`,
    )
    .all(params);
  const topModelTokens = new Map<string, number>();
  for (const r of modelRows) {
    const t = out.get(r.user);
    if (!t) continue;
    const tokens = rowTokens(r);
    t.inputTokens += r.input;
    t.outputTokens += r.output;
    t.cacheCreationTokens += r.cacheCreation;
    t.cacheReadTokens += r.cacheRead;
    t.tokens += tokens;
    t.costUsd += rowCost(pricing, r);
    t.turns += r.turns;
    t.lastActiveAt = Math.max(t.lastActiveAt ?? 0, r.lastActiveAt);
    if (tokens > (topModelTokens.get(r.user) ?? -1)) {
      topModelTokens.set(r.user, tokens);
      t.topModel = r.model;
    }
  }

  for (const r of db
    .query<{ user: string; prompts: number }, typeof params>(
      `${cte.sql}
       SELECT e.user, COUNT(*) AS prompts FROM events e
       WHERE e.user IN (SELECT user FROM visible) AND ${window} AND e.message_type = 'user'
       GROUP BY e.user`,
    )
    .all(params)) {
    const t = out.get(r.user);
    if (t) t.prompts = r.prompts;
  }

  // ponytail: 5-minute buckets. Switching between two sessions inside one
  // bucket counts as 2, and a >5 min silent tool call drops out. Move to
  // merged activity intervals if people start comparing decimals.
  for (const r of db
    .query<
      { user: string; agentBuckets: number; activeBuckets: number; peakAgents: number },
      typeof params & { bucket: number }
    >(
      `${cte.sql},
       b AS (
         SELECT e.user, e.timestamp / $bucket AS bucket,
                COUNT(DISTINCT e.session_id || ':' || COALESCE(e.agent_id, '')) AS agents
         FROM events e
         WHERE e.user IN (SELECT user FROM visible) AND ${window} AND e.message_type = 'assistant'
         GROUP BY e.user, bucket)
       SELECT user, SUM(agents) AS agentBuckets, COUNT(*) AS activeBuckets, MAX(agents) AS peakAgents
       FROM b GROUP BY user`,
    )
    .all({ ...params, bucket: AGENT_BUCKET_MS })) {
    const t = out.get(r.user);
    if (!t) continue;
    t.activeHours = (r.activeBuckets * AGENT_BUCKET_MS) / 3_600_000;
    t.peakAgents = r.peakAgents;
    if (t.activeHours >= MIN_ACTIVE_HOURS) {
      t.parallelism = Math.round((r.agentBuckets / r.activeBuckets) * 100) / 100;
      t.tokensPerActiveHour = Math.round(t.tokens / t.activeHours);
    }
  }

  for (const t of out.values()) {
    t.costUsd = roundUsd(t.costUsd);
    t.activeHours = Math.round(t.activeHours * 100) / 100;
  }
  return out;
}

const SORTS: Record<SortKey, (a: UsageTotals, b: UsageTotals) => number> = {
  tokens: (a, b) => b.tokens - a.tokens,
  cost: (a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens,
  parallelism: (a, b) => (b.parallelism ?? -1) - (a.parallelism ?? -1) || b.tokens - a.tokens,
};

export function leaderboard(
  db: Db,
  pricing: PricingCache,
  scope: Scope,
  range: Range,
  sort: SortKey = "tokens",
): LeaderboardEntry[] {
  const totals = totalsFor(db, pricing, visibleCte(scope), range);
  return [...totals]
    .map(([name, t]) => ({ name, ...t }))
    .sort((a, b) => SORTS[sort](a, b) || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export interface ModelUsage {
  model: string;
  tokens: number;
  costUsd: number;
  turns: number;
}

export interface DailyUsage {
  /** Local date `YYYY-MM-DD` in the viewer's timezone. */
  date: string;
  tokens: number;
  costUsd: number;
  turns: number;
}

export interface UserDetail {
  name: string;
  totals: UsageTotals;
  models: ModelUsage[];
  daily: DailyUsage[];
}

/** `tzOffsetMin` is `Date#getTimezoneOffset()` of the viewer. Caller checks visibility. */
export function userDetail(
  db: Db,
  pricing: PricingCache,
  name: string,
  range: Range,
  tzOffsetMin: number,
): UserDetail {
  const cte = { sql: "WITH visible(user) AS (SELECT $name)", params: { name } };
  const totals = totalsFor(db, pricing, cte, range).get(name) ?? emptyTotals();
  const params = { name, since: range.since, until: range.until };

  const models = db
    .query<ModelSumRow, typeof params>(
      `SELECT user, model, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
              SUM(cache_creation_tokens) AS cacheCreation, SUM(cache_read_tokens) AS cacheRead,
              COUNT(*) AS turns, MAX(timestamp) AS lastActiveAt
       FROM events WHERE user = $name AND timestamp >= $since AND timestamp < $until
         AND message_type = 'assistant'
       GROUP BY model`,
    )
    .all(params)
    .map((r) => ({
      model: r.model,
      tokens: rowTokens(r),
      costUsd: roundUsd(rowCost(pricing, r)),
      turns: r.turns,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const shift = -tzOffsetMin * 60_000;
  const byDay = new Map<number, DailyUsage>();
  for (const r of db
    .query<ModelSumRow & { day: number }, typeof params & { shift: number; dayMs: number }>(
      `SELECT user, model, (timestamp + $shift) / $dayMs AS day,
              SUM(input_tokens) AS input, SUM(output_tokens) AS output,
              SUM(cache_creation_tokens) AS cacheCreation, SUM(cache_read_tokens) AS cacheRead,
              COUNT(*) AS turns, MAX(timestamp) AS lastActiveAt
       FROM events WHERE user = $name AND timestamp >= $since AND timestamp < $until
         AND message_type = 'assistant'
       GROUP BY day, model`,
    )
    .all({ ...params, shift, dayMs: DAY_MS })) {
    let d = byDay.get(r.day);
    if (!d) {
      d = { date: new Date(r.day * DAY_MS).toISOString().slice(0, 10), tokens: 0, costUsd: 0, turns: 0 };
      byDay.set(r.day, d);
    }
    d.tokens += rowTokens(r);
    d.costUsd += rowCost(pricing, r);
    d.turns += r.turns;
  }
  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, d]) => ({ ...d, costUsd: roundUsd(d.costUsd) }));

  return { name, totals, models, daily };
}
