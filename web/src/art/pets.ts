import { PET_H, PET_W, PETS, type Pet } from "./pet-base.ts";
import { outfitArt, variantArt } from "./pet-variants/index.ts";
import { bake, cached } from "./pixels.ts";

export type { Pet };
// The sprites live in pet-base.ts so the variation files, which build on them and which this file
// imports, can load first without a cycle.
export { PET_H, PET_W, PETS };

/** The art of `pet` in look `variant` (0 is the original, and also what a variation without art yet shows). */
const artOf = (pet: number, variant: number, outfit: string): Pet | null =>
  outfitArt(outfit || null) ?? (variant > 0 ? variantArt(pet, variant) : null) ?? PETS[pet] ?? null;

/** One frame of pet `pet` in look `variant`, in the costume `outfit` (`petOutfit`) if any, or null for none. */
export const petFrame = (
  pet: number,
  left: boolean,
  hop: boolean,
  variant = 0,
  outfit: string | null = null,
): HTMLCanvasElement | null => (PETS[pet] ? frame(pet, left, hop, variant, outfit ?? "") : null);

const frame = cached(
  (pet: number, left: boolean, hop: boolean, variant: number, outfit: string) =>
    `${pet}:${left}:${hop}:${variant}:${outfit}`,
  (pet: number, left: boolean, hop: boolean, variant: number, outfit: string) => {
    const art = artOf(pet, variant, outfit)!;
    return bake(PET_W, PET_H, (p) => p.grid(art.frames[hop ? 1 : 0], art.pal, 0, 0, left));
  },
);
