/**
 * Performance budgets, in hardware-independent counts. A room is counted on its own (no people or effects) after batching,
 * freezing the people and pets who stand about, and atlasing the small pictures: that is what `web/test/perf-budget.test.ts`
 * checks (Ultra draws what High does) and what `bun scripts/perf/counts.ts medium --check` checks for Medium's plainer
 * geometry. `triangles` is one pass over the room's smooth variant (the Voxel style's blocks are fewer); `textureMB` is the
 * room's canvas textures, uncompressed with mipmaps. Raise a number only with a reason in the commit.
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

// The dorm's stairs down are the shared exit kit's (`exits3d.ts`): the lit well and the lamp's pool add two batches.
// The town carries the four shop fronts of the real game (+35 draw calls, +70k triangles, +2.8 MB of textures over the pass-2
// measurement, which had bare houses there); the live layers (gate, tables, events) are budgeted apart. Its lamps and lit
// windows batch as day and night copies since the sampling of the hours stopped counting their swap as moving (353 -> 312).
export const BUDGETS: Record<BudgetTier, Record<string, RoomBudget>> = {
  // Plain boxes and round things with fewer segments.
  medium: {
    town: room(320, 370_000, 90, 17),
    hq: room(35, 10_000, 20, 1),
    office: room(35, 7_500, 25, 1),
    inn: room(180, 35_000, 140, 2),
    upstairs: room(26, 3_500, 15, 1),
    basement: room(70, 19_000, 55, 1),
    dungeon: room(50, 15_000, 20, 1),
    "shop-furniture": room(235, 36_000, 180, 13),
    "shop-clothes": room(470, 126_000, 300, 8),
    "shop-barber": room(290, 76_000, 150, 2),
    "shop-pets": room(315, 362_000, 145, 2),
  },
  // Chamfered boxes: High, and Ultra, which only differs in post and shadows.
  high: {
    town: room(320, 445_000, 90, 17),
    hq: room(35, 24_000, 20, 1),
    office: room(35, 10_000, 25, 1),
    // +500 for the request pile's board on the north wall (cork, four notes, a plank).
    inn: room(180, 56_500, 140, 2),
    upstairs: room(26, 9_000, 15, 1),
    basement: room(70, 41_000, 55, 1),
    dungeon: room(50, 43_000, 20, 1),
    "shop-furniture": room(235, 76_000, 180, 13),
    "shop-clothes": room(470, 142_000, 300, 8),
    "shop-barber": room(290, 90_000, 150, 2),
    "shop-pets": room(315, 387_000, 145, 2),
  },
};

export const budgetFor = (roomId: string, tier: BudgetTier = "high"): RoomBudget => BUDGETS[tier][roomId]!;
