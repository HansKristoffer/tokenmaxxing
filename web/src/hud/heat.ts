/** The player card's small texts: pure, so they're tested without a browser. */

const DAY_MS = 86_400_000;

/** "today", "yesterday", "3 days ago": how long since the world day `day`, on the day `today`. */
export function daysAgoText(day: string, today: string): string {
  // Noon UTC, as `dayText` reads a world day, so no time zone moves either day by one.
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  const dayMs = Date.parse(`${day}T12:00:00Z`);
  const n = Math.round((todayMs - dayMs) / DAY_MS);

  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  // Days up to two months, then months of 30 days: close enough for a label.
  if (n < 60) return `${n} days ago`;
  return `${Math.round(n / 30)} months ago`;
}

const SOURCE_NAMES: Record<string, string> = {
  claude_code: "Claude Code",
  claude_cowork: "Cowork",
  codex: "Codex",
  cursor_local: "Cursor",
  grok_bot: "Grok Bot",
  opencode: "OpenCode",
  github: "GitHub",
};

export const sourceName = (source: string): string => SOURCE_NAMES[source] ?? source;
