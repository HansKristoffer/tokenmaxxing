/** Which models the town runs: the Models board on the leaderboard. */
import { type RangeKey, rangeDays } from "@tokenmaxxing/core/range.ts";
import { all, pricing, type Sql } from "../actors/shared.ts";
import { rowCost, rowTokens, type UsageRow } from "../stats.ts";

export interface BoardModel {
  model: string;
  tokens: number;
  costUsd: number;
  /** People who ran it in the range. */
  users: number;
  turns: number;
}

export interface ModelBoard {
  range: RangeKey;
  /** Busiest first. */
  models: BoardModel[];
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

/** Every model run in the range, ranked by tokens, with the town's totals. Models with no name aren't listed. */
export async function modelBoard(sql: Sql, range: RangeKey, now: number): Promise<ModelBoard> {
  const { from, to } = rangeDays(range, now);
  const rows = await all<UsageRow & { users: number }>(
    sql,
    `SELECT model, SUM(input) AS input, SUM(output) AS output, SUM(cache_creation) AS cacheCreation,
            SUM(cache_read) AS cacheRead, SUM(turns) AS turns, SUM(reported_cost_cents) AS reportedCostCents,
            COUNT(DISTINCT user_id) AS users
     FROM usage_daily WHERE day >= ? AND day <= ? AND model != 'unknown' GROUP BY model`,
    from ?? "0000-00-00",
    to,
  );
  const [people] = await all<{ users: number }>(
    sql,
    "SELECT COUNT(DISTINCT user_id) AS users FROM usage_daily WHERE day >= ? AND day <= ? AND model != 'unknown'",
    from ?? "0000-00-00",
    to,
  );
  const models = rows
    .map((r) => ({
      model: r.model,
      tokens: rowTokens(r),
      costUsd: rowCost(pricing, r),
      users: r.users,
      turns: r.turns,
    }))
    .filter((m) => m.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || a.model.localeCompare(b.model));
  const promptSide = rows.reduce((n, r) => n + r.input + r.cacheCreation + r.cacheRead, 0);
  const cached = rows.reduce((n, r) => n + r.cacheRead, 0);
  return {
    range,
    models: models.slice(0, MODELS_TOP),
    totals: {
      tokens: models.reduce((n, m) => n + m.tokens, 0),
      costUsd: models.reduce((n, m) => n + m.costUsd, 0),
      turns: models.reduce((n, m) => n + m.turns, 0),
      users: people?.users ?? 0,
      cacheHit: promptSide > 0 ? cached / promptSide : null,
    },
  };
}
