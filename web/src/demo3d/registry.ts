/**
 * The one place that knows about slice files. A slice that exports `<NAME>_ASSETS: readonly Asset[]` adds
 * ONE entry to `SLICES` below (a plain static list: no globbing). `loadSlices()` imports each, registers
 * every `tile:<ch>` asset with the world (`registerTileAssets`) and returns all the exported assets so the
 * catalogue can show them.
 *
 * The same tile character means different things in different maps, so an entry says which rooms its
 * `tile:` assets are for (`rooms`, or `scope` per asset id). Where two slices draw the same character in
 * the same room the earlier entry wins (ids are only registered once), and the choices are:
 *   - `x` (exit door): the Tavern's own `exitDoor` in inn; the dungeon's exit in the dungeon; the framework's
 *     generic door elsewhere (basement/hq/office are hand-built or generic).
 *   - `M` (wall terminal): the basement's (boss HP + raid) in the basement; the dungeon's in the dungeon.
 *   - `G` (gate), `D`, `R` (doors): the town is drawn by `town3d.ts` and the hq by `hq3d.ts`, so these only
 *     matter in the dungeon (its gate / exit) and as the hq's office doors (`R`, the dungeon slice's).
 *   - `U` (trophy shelf): the dungeon slice's, in the office. `Q` (pet bed): the pets slice's, in the office.
 *   - `i` (tournament board): the basement's (it had the better board with the bracket).
 *   - `Y`, `V` (golden hourglass / rebase): dungeon only (loot items); nowhere else uses them.
 */
import type { Asset } from "./furniture.ts";
import { type MapId, registerTileAssets } from "./world.ts";

interface Slice {
  load: () => Promise<Record<string, unknown>>;
  /** Rooms the slice's `tile:` assets belong to (default: every room). */
  rooms?: readonly MapId[];
  /** Per asset id (`tile:U`), rooms overriding `rooms`. */
  scope?: Record<string, readonly MapId[]>;
}

export const SLICES: Slice[] = [
  { load: () => import("./tavern3d.ts"), rooms: ["inn", "upstairs"] },
  { load: () => import("./basement3d.ts"), rooms: ["basement"] },
  { load: () => import("./tables3d.ts"), rooms: ["basement"] },
  {
    load: () => import("./dungeon3d.ts"),
    rooms: ["dungeon"],
    scope: { "tile:U": ["office"], "tile:R": ["hq"], "tile:D": ["hq"] },
  },
  { load: () => import("./pets3d.ts"), rooms: ["office"] },
  { load: () => import("./furniture3d.ts") },
  { load: () => import("./hq3d.ts"), rooms: ["hq"] },
  { load: () => import("./town3d.ts"), rooms: ["town"] },
  { load: () => import("./fx3d.ts") },
];

export async function loadSlices(): Promise<Asset[]> {
  const out: Asset[] = [];
  const seen = new Set<string>();
  for (const s of SLICES) {
    const mod = await s.load();
    for (const [key, value] of Object.entries(mod)) {
      if (!key.endsWith("_ASSETS") || !Array.isArray(value)) continue;
      const list = (value as Asset[]).filter((a) => !seen.has(a.id));
      for (const a of list) seen.add(a.id);
      const byRoom = new Map<string, Asset[]>();
      for (const a of list) {
        const rooms = s.scope?.[a.id] ?? s.rooms;
        const k = rooms?.join(",") ?? "";
        byRoom.set(k, [...(byRoom.get(k) ?? []), a]);
      }
      for (const [k, assets] of byRoom) registerTileAssets(assets, k ? (k.split(",") as MapId[]) : undefined);
      out.push(...list);
    }
  }
  return out;
}
