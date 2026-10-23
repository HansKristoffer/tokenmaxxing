/**
 * Performance budgets, per room, in hardware-independent counts. Counted on the static room alone (no actors), batched: the
 * live frame adds avatars and effects (see `scripts/perf-report.mjs` for whole-scene numbers); triangles are what one pass submits;
 * `textureMB` is canvas textures, uncompressed with mipmaps. A change that goes over fails
 * `web/test/perf-budget.test.ts`; raise a number only with a reason in the commit.
 */
export interface RoomBudget {
  drawCalls: number;
  triangles: number;
  materials: number;
  textureMB: number;
}

// The town carries the four shop fronts (about 55k triangles between them: the pet shop's pens are half of it); the
// shop rooms are the real interiors now (they were bare shells when first budgeted), shelves and displays included.
export const BUDGETS: Record<string, RoomBudget> = {
  town: { drawCalls: 120, triangles: 300_000, materials: 40, textureMB: 40 },
  hq: { drawCalls: 60, triangles: 15_000, materials: 40, textureMB: 20 },
  office: { drawCalls: 120, triangles: 15_000, materials: 110, textureMB: 20 },
  inn: { drawCalls: 300, triangles: 60_000, materials: 260, textureMB: 20 },
  upstairs: { drawCalls: 45, triangles: 18_000, materials: 25, textureMB: 20 },
  basement: { drawCalls: 80, triangles: 55_000, materials: 60, textureMB: 20 },
  dungeon: { drawCalls: 70, triangles: 50_000, materials: 40, textureMB: 20 },
  "shop-furniture": { drawCalls: 80, triangles: 20_000, materials: 20, textureMB: 20 },
  "shop-clothes": { drawCalls: 80, triangles: 20_000, materials: 20, textureMB: 20 },
  "shop-barber": { drawCalls: 80, triangles: 20_000, materials: 20, textureMB: 20 },
  "shop-pets": { drawCalls: 80, triangles: 20_000, materials: 20, textureMB: 20 },
};

export const budgetFor = (room: string): RoomBudget => BUDGETS[room]!;

/** Frame-time budgets in ms on the reference machine of `scripts/perf-harness.mjs` (CPU time in the frame callback, p95). */
export const FRAME_BUDGET_MS = { medium: 6, high: 8, ultra: 10 } as const;

/** Memory budgets for a whole session: live GL textures/buffers after 50 room switches may not grow past this share. */
export const LEAK_TOLERANCE = 1.1;
