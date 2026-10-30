/**
 * Where the cube-built body gear (`gear3dBody.ts`) sits on the smooth bodies. Outfits and back items are drawn for the
 * voxel torso (7 x 8 x 4 cubes of `U`, shoulders at its top); on the grown, chibi and bot bodies a blocky frame is
 * laid over the torso, scaled to its size, and each arm gets a frame scaled to its. The prestige sets use it.
 */
import { PRESTIGE_BASE, PRESTIGE_ITEMS } from "@tokenmaxxing/core/prestige.ts";
import type { CharStyle } from "./styles.ts";
import { U } from "./voxgear.ts";

export interface SmoothFit {
  /** Which node holds the torso: the `chest` the arms hang from (`arms`), or the body root (`body`). */
  parent: "arms" | "body";
  /** Where the torso's belt centre is, in the parent. */
  at: [number, number, number];
  /** Stretches the cube frame onto the torso (a voxel one is 0.315 wide, 0.36 tall, 0.18 deep). */
  torso: [number, number, number];
  /** The same for each arm (a voxel arm is about 0.11 wide, 0.33 long). */
  arm: [number, number, number];
  /** Back items keep their proportions: one scale, as wide as the torso. */
  back: number;
}

const VOX_W = 7 * U;
const VOX_H = 8 * U;
const VOX_D = 4 * U;

/** A torso of this size in a frame whose origin is its belt centre. */
const torsoFit = (w: number, h: number, d: number): SmoothFit["torso"] => [w / VOX_W, h / VOX_H, d / VOX_D];

/** The fit for a smooth body, or nothing for one the gear does not dress (animals have a round tummy). */
export function smoothFit(style: CharStyle, human: boolean, width = 1): SmoothFit | null {
  switch (style) {
    case "grown":
      if (!human) return null;
      return {
        parent: "arms",
        at: [0, 0, 0],
        torso: torsoFit(0.29 * width, 0.34, 0.17),
        arm: [0.75, 0.88, 0.75],
        back: 0.93 * Math.min(1, width + 0.04),
      };
    case "animal":
    case "chibi":
      if (!human) return null;
      return {
        parent: "body",
        at: [0, 0.22, 0],
        torso: torsoFit(0.3, 0.26, 0.2),
        arm: [0.77, 0.55, 0.77],
        back: 0.8,
      };
    case "bot":
      return {
        parent: "body",
        at: [0, 0.18, 0],
        torso: torsoFit(0.3, 0.26, 0.22),
        arm: [0.5, 0.55, 0.5],
        back: 0.8,
      };
    default:
      return null;
  }
}

/** Whether a worn outfit (by look index) or back item (by name) is a prestige one: the only body gear drawn on smooth bodies. */
export const isPrestigeOutfit = (index: number): boolean =>
  index >= PRESTIGE_BASE && index < PRESTIGE_BASE + 100;
const BACKS = new Set(PRESTIGE_ITEMS.filter((i) => i.slot === "back").map((i) => i.name));
export const isPrestigeBack = (name: string): boolean => BACKS.has(name);
