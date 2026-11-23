import { NO_PRESTIGE, type PrestigeBadge } from "@tokenmaxxing/core/prestige-run.ts";

/** Someone's prestige badge from any player payload (card, board row, who list, peek); a missing one is none. */
export function prestigeOf(who: object | null | undefined): PrestigeBadge {
  const p = (who as { prestige?: Partial<PrestigeBadge> } | null | undefined)?.prestige;
  const rank = p?.rank;
  if (!p || rank === undefined || !Number.isInteger(rank) || rank < 1) return NO_PRESTIGE;
  return {
    rank,
    runLevel: p.runLevel && p.runLevel > 0 ? p.runLevel : 0,
    runInto: p.runInto && p.runInto > 0 ? p.runInto : 0,
  };
}
