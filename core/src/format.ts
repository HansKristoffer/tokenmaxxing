const LEVEL_TITLES = [
  "Newcomer",
  "Prompt Intern",
  "Context Goblin",
  "Cache Enjoyer",
  "Agent Wrangler",
  "Subagent Shepherd",
  "Token Baron",
  "Gigamaxxer",
  "Context Lord",
  "Teramaxxer",
  "Petamaxxer",
  "Datacenter Tycoon",
  "Compute Overlord",
  "Singularity",
];

/**
 * Half-decade steps from 1M lifetime tokens (1M → L1, 10M → L3, 100M → L5, 1B → L7, 10B → L9),
 * eighth-decade steps from 10B to Singularity at 31.6B (L13), then half-decade steps again.
 */
export function levelFor(tokens: number): number {
  if (tokens < 1e6) return 0;
  const decades = Math.log10(tokens / 1e6);
  if (decades < 4) return Math.floor(2 * decades) + 1;
  if (decades < 4.5) return Math.floor(8 * decades) - 23;
  return Math.floor(2 * decades) + 4;
}

/** Lifetime tokens where a level starts, the inverse of levelFor. */
export function levelAt(level: number): number {
  if (level < 1) return 0;
  const decades = level <= 9 ? (level - 1) / 2 : level <= 13 ? (level + 23) / 8 : (level - 4) / 2;
  return Math.ceil(1e6 * 10 ** decades);
}

export const levelTitle = (level: number): string => LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)]!;

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export const usd = (n: number): string => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);

/** "18:42", or "3:04:05" past an hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Whole seconds until `at`, never below 0. */
export const secondsUntil = (at: number, now: number): number => Math.max(0, Math.ceil((at - now) / 1000));

/** "3h 25m", or "40m" under an hour. */
export function hoursText(hours: number): string {
  const m = Math.round(hours * 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** "15 min", "1 hour", "24 hours". */
export const minutesText = (minutes: number): string =>
  minutes >= 60 ? plural(minutes / 60, "hour") : `${minutes} min`;

/** "1 game", "3 games". */
export const plural = (n: number, word: string, words = `${word}s`): string =>
  `${n} ${n === 1 ? word : words}`;
