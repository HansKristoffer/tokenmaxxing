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
