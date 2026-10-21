import type { Palette } from "../pixels.ts";

/** A pet's two frames (a standing one and a hop), 12 columns by 10 rows each, facing right. */
export interface PetVariant {
  /** One of `PET_VARIANTS[pet]` in core/src/pets.ts. */
  id: string;
  name: string;
  frames: [string[], string[]];
  pal: Palette;
}

/** `[row, column, character]`: one pixel of the grid changed. */
export type Patch = [number, number, string];

/**
 * A colour swap: the base pet with some palette entries replaced, and optionally a few pixels changed
 * (in both frames, as given; use `patches1` for the second frame only where the hop moves the pixel).
 */
export function swap(
  base: { frames: [string[], string[]]; pal: Palette },
  id: string,
  name: string,
  pal: Palette,
  patches: Patch[] = [],
  patches1: Patch[] = patches,
): PetVariant {
  const edit = (rows: string[], list: Patch[]) =>
    rows.map((row, y) =>
      list.reduce((r, [py, px, ch]) => (py === y ? r.slice(0, px) + ch + r.slice(px + 1) : r), row),
    );
  return {
    id,
    name,
    frames: [edit(base.frames[0], patches), edit(base.frames[1], patches1)],
    pal: { ...base.pal, ...pal },
  };
}
