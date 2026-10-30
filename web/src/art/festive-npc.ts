import type { FestiveId } from "@tokenmaxxing/core/festive.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { gudrunSprite } from "./paaske.ts";

/**
 * The 2D sprites of the festive NPCs (`FESTIVE_NPC` in `core/src/festive.ts`). A theme's agent adds its entry here:
 * a function from the way it faces and a 0/1 breath (swap it every ~700 ms) to a baked canvas, about 16 x 20 pixels
 * with its feet at the bottom (cache the canvases, as `art/cart.ts` `merchantFrame` does). No entry, nothing drawn.
 */
export type NpcSprite = (facing: Facing, breath: 0 | 1) => HTMLCanvasElement;

export const NPC_SPRITES: Partial<Record<FestiveId, NpcSprite>> = {};

NPC_SPRITES.paaske = gudrunSprite;
