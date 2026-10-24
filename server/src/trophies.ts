import { dayKey } from "@tokenmaxxing/core/range.ts";
import { type HourFacts, type PrFacts, type Trophy, trophiesFor } from "@tokenmaxxing/core/trophies.ts";
import type { Sql } from "./actors/shared.ts";

const HOUR_MS = 3_600_000;

/**
 * A player's events boiled down for trophies: tokens and prompts per hour, and their PRs. Kept in the
 * actor's memory and topped up from the last event id it read, so only the first look after a wake
 * reads the whole history. Events are only appended, except by a wipe (which starts a new cache) and the
 * one-off Grok Bot cleanup (the next wake reads it right).
 */
interface TrophyCache {
  lastId: number;
  hours: Map<number, HourFacts>;
  prs: PrFacts[];
}

export const trophyCache = (): TrophyCache => ({ lastId: 0, hours: new Map(), prs: [] });

/** The trophies a player has earned, from their own events. */
export async function trophiesOf(sql: Sql, cache: TrophyCache, now: number): Promise<Trophy[]> {
  const [{ maxId }] = (await sql.execute("SELECT COALESCE(MAX(id), 0) AS maxId FROM events")) as [
    { maxId: number },
  ];
  if (maxId > cache.lastId) {
    const hours = (await sql.execute(
      `SELECT timestamp / ${HOUR_MS} AS h,
              SUM(CASE WHEN message_type = 'assistant'
                  THEN input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens ELSE 0 END) AS tokens,
              SUM(message_type = 'user') AS prompts,
              GROUP_CONCAT(DISTINCT CASE WHEN message_type = 'assistant'
                  AND input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens > 0
                  THEN source END) AS sources
       FROM events WHERE id > ? AND id <= ? GROUP BY h`,
      cache.lastId,
      maxId,
    )) as { h: number; tokens: number; prompts: number; sources: string | null }[];
    for (const r of hours) {
      const at = r.h * HOUR_MS;
      const was = cache.hours.get(at) ?? { hour: at, tokens: 0, prompts: 0 };
      const sources = new Set([...(was.sources ?? []), ...(r.sources?.split(",") ?? [])]);
      cache.hours.set(at, {
        hour: at,
        tokens: was.tokens + r.tokens,
        prompts: was.prompts + r.prompts,
        sources: [...sources],
      });
    }
    const prs = (await sql.execute(
      "SELECT timestamp AS at, message_id AS hash FROM events WHERE id > ? AND id <= ? AND message_type = 'pr'",
      cache.lastId,
      maxId,
    )) as PrFacts[];
    cache.prs.push(...prs);
    cache.lastId = maxId;
  }
  return trophiesFor({ hours: [...cache.hours.values()], prs: cache.prs, today: dayKey(now) });
}
