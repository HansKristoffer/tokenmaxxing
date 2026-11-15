import type { Sql } from "./actors/shared.ts";

/** One battle update in flight, with at most one newer update waiting behind it. */
export function coalesceBattleUpdates() {
  let pending: Promise<void> | null = null;
  let again = false;
  return (update: () => Promise<unknown>): Promise<void> => {
    again = true;
    pending ??= (async () => {
      try {
        while (again) {
          again = false;
          // Runs on a microtask: the caller's call returns before the update starts.
          await Promise.resolve().then(update);
        }
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}

/** Reports `days`, then forgets them: done, as far as town and world go. */
export async function reportUsageDays(
  sql: Sql,
  days: string[],
  report: (days: string[]) => Promise<void>,
): Promise<void> {
  // Forgotten only once the report has gone through, so a failed report leaves the days to retry.
  await report(days);

  const placeholders = days.map(() => "?").join(",");
  await sql.execute(`DELETE FROM pending_usage_days WHERE day IN (${placeholders})`, ...days);
}

/** Reports the oldest pending days, a week at most; false once none are left. */
async function flushUsageBatch(sql: Sql, report: (days: string[]) => Promise<void>): Promise<boolean> {
  const rows = (await sql.execute("SELECT day FROM pending_usage_days ORDER BY day LIMIT 7")) as {
    day: string;
  }[];
  if (!rows.length) return false;

  const days = rows.map((r) => r.day);
  await reportUsageDays(sql, days, report);
  return true;
}

/** Retry days until town and world have acknowledged their derived totals. */
export async function flushUsageReports(sql: Sql, report: (days: string[]) => Promise<void>): Promise<void> {
  while (await flushUsageBatch(sql, report));
}

/**
 * Like `flushUsageReports`, but a batch per turn of `run` (the player's lock): a long backlog, like
 * the one-time repair of a big history, mustn't hold up syncs.
 */
export async function drainUsageReports(
  sql: Sql,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  signal: AbortSignal,
  report: (days: string[]) => Promise<void>,
): Promise<void> {
  while (!signal.aborted && (await run(() => flushUsageBatch(sql, report))));
}
