import { LEGENDARY_LEVEL } from "@tokenmaxxing/core/milestones.ts";
import type { PrestigeBadge } from "@tokenmaxxing/core/prestige-run.ts";
import { AURA_X, AURA_Y, auraFrame, HALO_LIFT, petCrown } from "../art/aura.ts";
import { CA_X, CA_Y, caseAuraFrame } from "../art/case-aura.ts";
import { petwearRank, petwearRise, prestigePetwear, wornAtNeck } from "../art/prestige-petwear.ts";
import { petHatRows } from "../art/wardrobe.ts";
import type { Avatar } from "./world.ts";

/** The legendary level's glow and halo, behind a character drawn at (x, y). */
export function drawAura(g: CanvasRenderingContext2D, a: Avatar, x: number, y: number, now: number): void {
  if (a.info.level >= LEGENDARY_LEVEL) g.drawImage(auraFrame(now), x - AURA_X, y - AURA_Y);
  const worn = a.info.look.aura ? caseAuraFrame(a.info.look.aura, now) : null;
  if (worn) g.drawImage(worn, x - CA_X, y - CA_Y);
}

/** The pet accessory of their prestige (`petwearRank`), or 0. */
export const petwearOf = (a: Avatar): number =>
  petwearRank((a.info as { prestige?: PrestigeBadge }).prestige);

/** Rows the pet accessory reaches above the pet's top row, for the cull to leave room (`petwearRise`). */
export const petRise = (a: Avatar): number => {
  const r = petwearOf(a);
  return r ? petwearRise(r) + petHatRows(a.info.look.petwear) : 0;
};

/**
 * Their pet's crown, or its prestige accessory (which stands in for the crown unless it sits at the neck),
 * over a pet frame drawn at (x, y).
 */
export function drawPetCrown(
  g: CanvasRenderingContext2D,
  a: Avatar,
  x: number,
  y: number,
  left: boolean,
  hop: boolean,
  now = 0,
): void {
  const rank = petwearOf(a);
  const worn =
    rank && prestigePetwear(rank, a.info.look.pet, left, hop, now, petHatRows(a.info.look.petwear));
  if (worn) g.drawImage(worn[0], x + worn[1], y + worn[2]);
  const crown =
    !(worn && !wornAtNeck(rank)) && a.info.level >= LEGENDARY_LEVEL && petCrown(a.info.look.pet, left, hop);
  if (crown) g.drawImage(crown[0], x + crown[1], y + crown[2]);
}

/** World pixels to lift their name tag by, so it sits over the halo rather than on it. */
export const labelLift = (a: Avatar): number => (a.info.level >= LEGENDARY_LEVEL ? HALO_LIFT : 0);
