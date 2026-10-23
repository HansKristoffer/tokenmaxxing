/**
 * Performance budgets, in hardware-independent counts. A room is counted on its own (no people or effects) after batching,
 * freezing the people and pets who stand about, and atlasing the small pictures: that is what `web/test/perf-budget.test.ts`
 * checks (Ultra draws what High does) and what `bun scripts/perf/counts.ts medium --check` checks for Medium's plainer
 * geometry. `triangles` is one pass over the room's smooth variant (the Voxel style's blocks are fewer); `textureMB` is the
 * room's canvas textures, uncompressed with mipmaps. Raise a number only with a reason in the commit.
 *
 * Whole frames (people, weather, shadows, post) are budgeted by tier in `FRAME_BUDGETS` and checked on a real browser by
 * `bun scripts/perf-harness.mjs --check`.
 */
export interface RoomBudget {
  drawCalls: number;
  triangles: number;
  materials: number;
  textureMB: number;
}

export type BudgetTier = "medium" | "high";

const room = (drawCalls: number, triangles: number, materials: number, textureMB: number): RoomBudget => ({
  drawCalls,
  triangles,
  materials,
  textureMB,
});

export const BUDGETS: Record<BudgetTier, Record<string, RoomBudget>> = {
  // Plain boxes and round things with fewer segments.
  medium: {
    town: room(340, 325_000, 90, 15),
    hq: room(35, 10_000, 20, 1),
    office: room(35, 7_500, 25, 1),
    inn: room(180, 35_000, 140, 2),
    upstairs: room(24, 3_500, 15, 1),
    basement: room(70, 19_000, 55, 1),
    dungeon: room(50, 15_000, 20, 1),
    "shop-furniture": room(235, 36_000, 180, 13),
    "shop-clothes": room(470, 126_000, 300, 8),
    "shop-barber": room(290, 76_000, 150, 2),
    "shop-pets": room(315, 362_000, 145, 2),
  },
  // Chamfered boxes: High, and Ultra, which only differs in post and shadows.
  high: {
    town: room(340, 395_000, 90, 15),
    hq: room(35, 24_000, 20, 1),
    office: room(35, 10_000, 25, 1),
    inn: room(180, 56_000, 140, 2),
    upstairs: room(24, 9_000, 15, 1),
    basement: room(70, 41_000, 55, 1),
    dungeon: room(50, 43_000, 20, 1),
    "shop-furniture": room(235, 76_000, 180, 13),
    "shop-clothes": room(470, 142_000, 300, 8),
    "shop-barber": room(290, 90_000, 150, 2),
    "shop-pets": room(315, 387_000, 145, 2),
  },
};

export const budgetFor = (roomId: string, tier: BudgetTier = "high"): RoomBudget => BUDGETS[tier][roomId]!;

/**
 * A whole frame of the town with the default crowd, on the reference machine of `scripts/perf-harness.mjs`: draw calls and
 * triangles of one frame (shadow passes included), and the CPU time of the frame callback at p95.
 */
export interface FrameBudget {
  drawCalls: number;
  triangles: number;
  cpuP95Ms: number;
}
export const FRAME_BUDGETS: Record<"medium" | "high" | "ultra", FrameBudget> = {
  medium: { drawCalls: 340, triangles: 185_000, cpuP95Ms: 3.5 },
  high: { drawCalls: 480, triangles: 200_000, cpuP95Ms: 4.5 },
  ultra: { drawCalls: 620, triangles: 230_000, cpuP95Ms: 5 },
};

/** The same, with `?crowd=40` (forty people and thirteen pets in the town): the worst case that must still hold. */
export const CROWD_FRAME_BUDGETS: Record<"medium" | "high" | "ultra", FrameBudget> = {
  medium: { drawCalls: 800, triangles: 270_000, cpuP95Ms: 4.5 },
  high: { drawCalls: 1250, triangles: 320_000, cpuP95Ms: 6.5 },
  ultra: { drawCalls: 1850, triangles: 410_000, cpuP95Ms: 8 },
};

/** Memory budgets for a whole session: live GL textures/buffers after 50 room switches may not grow past this share. */
export const LEAK_TOLERANCE = 1.1;
