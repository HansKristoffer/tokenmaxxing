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
  "Singularity",
];

/** Half-decade steps from 1M lifetime tokens: 1M → L1, 10M → L3, 100M → L5, 1B → L7, 10B → L9. */
export const levelFor = (tokens: number): number =>
  tokens < 1e6 ? 0 : Math.floor(2 * Math.log10(tokens / 1e6)) + 1;

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
