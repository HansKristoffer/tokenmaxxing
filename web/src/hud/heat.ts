/** The player card's heatmap and its small texts: pure, so they're tested without a browser. */

/**
 * 0 for a quiet day, else 1 to 4 on a square-root scale between the quietest active day (`min`) and the
 * busiest (`max`), so steady usage still shows steps and one huge day doesn't flatten the rest. When every
 * active day is the same, they all get 3.
 */
export function heatLevel(tokens: number, max: number, min = 0): 0 | 1 | 2 | 3 | 4 {
  if (!(tokens > 0) || !(max > 0)) return 0;
  const lo = Math.sqrt(Math.min(min, max));
  const span = Math.sqrt(max) - lo;
  if (!(span > 0)) return 3;
  const t = (Math.sqrt(tokens) - lo) / span;
  return Math.min(4, Math.max(1, 1 + Math.floor(t * 4))) as 1 | 2 | 3 | 4;
}

export interface HeatCell {
  day: string;
  tokens: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * The days, oldest first, laid out for a grid that fills down the weekdays (Monday first) and then
 * across the weeks: blanks (null) before the first day so it lands on its weekday.
 */
export function heatCells(days: readonly { day: string; tokens: number }[]): (HeatCell | null)[] {
  if (days.length === 0) return [];
  const max = Math.max(0, ...days.map((d) => d.tokens));
  const min = Math.min(max, ...days.filter((d) => d.tokens > 0).map((d) => d.tokens));
  const first = new Date(`${days[0]!.day}T12:00:00Z`).getUTCDay();
  const blanks = (first + 6) % 7;
  return [
    ...Array<null>(blanks).fill(null),
    ...days.map((d) => ({ day: d.day, tokens: d.tokens, level: heatLevel(d.tokens, max, min) })),
  ];
}

/** "today", "yesterday", "3 days ago": how long since the world day `day`, on the day `today`. */
export function daysAgoText(day: string, today: string): string {
  const n = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 60) return `${n} days ago`;
  return `${Math.round(n / 30)} months ago`;
}

const SOURCE_NAMES: Record<string, string> = {
  claude_code: "Claude Code",
  claude_cowork: "Cowork",
  codex: "Codex",
  cursor_local: "Cursor",
  grok_bot: "Grok Bot",
  github: "GitHub",
};

export const sourceName = (source: string): string => SOURCE_NAMES[source] ?? source;
