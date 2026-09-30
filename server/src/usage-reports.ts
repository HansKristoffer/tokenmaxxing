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
          await Promise.resolve().then(update);
        }
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}

/** Retry days until town and world have acknowledged their derived totals. */
export async function flushUsageReports(sql: Sql, report: (days: string[]) => Promise<void>): Promise<void> {
  for (;;) {
    const rows = (await sql.execute("SELECT day FROM pending_usage_days ORDER BY day LIMIT 7")) as {
      day: string;
    }[];
    if (!rows.length) return;
    const days = rows.map((r) => r.day);
    await report(days);
    await sql.execute(
      `DELETE FROM pending_usage_days WHERE day IN (${days.map(() => "?").join(",")})`,
      ...days,
    );
  }
}
