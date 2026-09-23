import { DAY_MS } from "@tokenmaxxing/core/range.ts";
import type { UserDetail } from "../api.ts";
import { fmtCompact } from "../format.ts";

const WEEKS = 26;

/** GitHub-style grid of the last 26 weeks; darker = more tokens (quartiles of active days). */
export function Activity({ daily }: { daily: UserDetail["daily"] }) {
  const byDate = new Map(daily.map((d) => [d.date, d.tokens]));
  const today = new Date();
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  // Start on a Monday so each column is one week.
  const start = end - ((new Date(end).getUTCDay() + 6) % 7) * DAY_MS - (WEEKS - 1) * 7 * DAY_MS;
  const sorted = [...byDate.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))] ?? 0;
  const level = (v: number) => (v <= 0 ? 0 : v <= q(0.25) ? 1 : v <= q(0.5) ? 2 : v <= q(0.75) ? 3 : 4);

  const cells = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    const tokens = byDate.get(date) ?? 0;
    cells.push(<span key={date} data-l={level(tokens)} title={`${date}: ${fmtCompact(tokens)} tokens`} />);
  }
  return <div className="activity">{cells}</div>;
}
