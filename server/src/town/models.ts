/** Which models the town runs, and who spends the most and the least: the Models board on the leaderboard. */
import { type RangeKey, rangeDays } from "@tokenmaxxing/core/range.ts";
import type { Look } from "@tokenmaxxing/core/world.ts";
import { all, pricing, type Sql } from "../actors/shared.ts";
import { rowCost, rowTokens, type UsageRow } from "../stats.ts";
import { lookOf, type UserRow } from "./users.ts";

export interface BoardModel {
  model: string;
  tokens: number;
  costUsd: number;
  /** People who ran it in the range. */
  users: number;
  turns: number;
}

/** Someone's spend over the range, across every model. */
export interface Spender {
  userId: number;
  name: string;
  look: Look;
  company: string | null;
  tokens: number;
  costUsd: number;
}

export interface ModelBoard {
  range: RangeKey;
  /** Busiest first. */
  models: BoardModel[];
  /** Who spent the most dollars, the biggest first, and who spent the least of the people who spent anything. */
  spenders: { most: Spender[]; least: Spender[] };
  totals: {
    tokens: number;
    costUsd: number;
    turns: number;
    /** People who ran any model, counted once. */
    users: number;
    /** Share of the prompt side (input, cache writes and cache reads) that came from the cache, 0 to 1; null with no input. */
    cacheHit: number | null;
  };
}

/** How many models the board lists; the rest only count in the totals. */
const MODELS_TOP = 100;
/** How many people each end of the spenders list shows. */
const SPENDERS_TOP = 5;

/** Every model run in the range, ranked by tokens, with the town's totals. Models with no name aren't listed. */
export async function modelBoard(sql: Sql, range: RangeKey, now: number): Promise<ModelBoard> {
  const { from, to } = rangeDays(range, now);
  const rows = await all<UsageRow & { userId: number }>(
    sql,
    `SELECT user_id AS userId, model, SUM(input) AS input, SUM(output) AS output,
            SUM(cache_creation) AS cacheCreation, SUM(cache_read) AS cacheRead, SUM(turns) AS turns,
            SUM(reported_cost_cents) AS reportedCostCents
     FROM usage_daily WHERE day >= ? AND day <= ? AND model != 'unknown' GROUP BY user_id, model`,
    from ?? "0000-00-00",
    to,
  );
  const priced = rows
    .map((r) => ({ ...r, tokens: rowTokens(r), costUsd: rowCost(pricing, r) }))
    .filter((r) => r.tokens > 0);

  const models = [...Map.groupBy(priced, (r) => r.model)].map(([model, rs]) => ({
    model,
    tokens: rs.reduce((n, r) => n + r.tokens, 0),
    costUsd: rs.reduce((n, r) => n + r.costUsd, 0),
    users: new Set(rs.map((r) => r.userId)).size,
    turns: rs.reduce((n, r) => n + r.turns, 0),
  }));
  models.sort((a, b) => b.tokens - a.tokens || a.model.localeCompare(b.model));

  const spend = [...Map.groupBy(priced, (r) => r.userId)]
    .map(([userId, rs]) => ({
      userId,
      tokens: rs.reduce((n, r) => n + r.tokens, 0),
      costUsd: rs.reduce((n, r) => n + r.costUsd, 0),
    }))
    .sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens || a.userId - b.userId);
  const most = spend.slice(0, SPENDERS_TOP);
  // Never the same person at both ends: with few people the least are whoever the most left over.
  const least = spend.slice(SPENDERS_TOP).reverse().slice(0, SPENDERS_TOP);
  const ids = [...most, ...least].map((s) => s.userId);
  const people = new Map(
    ids.length === 0
      ? []
      : (
          await all<UserRow & { company: string | null }>(
            sql,
            `SELECT u.id, u.name, u.company_id AS companyId, u.look, c.name AS company
             FROM users u LEFT JOIN companies c ON c.id = u.company_id
             WHERE u.id IN (${ids.map(() => "?").join(",")})`,
            ...ids,
          )
        ).map((u) => [u.id, u]),
  );
  const named = (list: typeof spend): Spender[] =>
    list.flatMap((s) => {
      const u = people.get(s.userId);
      return u ? [{ ...s, name: u.name, look: lookOf(u), company: u.company }] : [];
    });

  const promptSide = priced.reduce((n, r) => n + r.input + r.cacheCreation + r.cacheRead, 0);
  const cached = priced.reduce((n, r) => n + r.cacheRead, 0);
  return {
    range,
    models: models.slice(0, MODELS_TOP),
    spenders: { most: named(most), least: named(least) },
    totals: {
      tokens: models.reduce((n, m) => n + m.tokens, 0),
      costUsd: models.reduce((n, m) => n + m.costUsd, 0),
      turns: models.reduce((n, m) => n + m.turns, 0),
      users: spend.length,
      cacheHit: promptSide > 0 ? cached / promptSide : null,
    },
  };
}
