/**
 * The one place that knows about slice files. A slice that exports `<NAME>_ASSETS: readonly Asset[]` adds
 * ONE line to `SLICES` below, e.g.  `() => import("./tavern.ts"),`  (a plain static list: no globbing).
 * `loadSlices()` imports each, registers every `tile:<ch>` asset with the world (`registerTile`) and
 * returns all the exported assets so the catalogue can show them.
 */
import type { Asset } from "./furniture.ts";
import { registerTileAssets } from "./world.ts";

export const SLICES: (() => Promise<Record<string, unknown>>)[] = [
  // () => import("./tavern.ts"),
];

export async function loadSlices(): Promise<Asset[]> {
  const out: Asset[] = [];
  const seen = new Set<string>();
  for (const load of SLICES) {
    const mod = await load();
    for (const [key, value] of Object.entries(mod)) {
      if (!key.endsWith("_ASSETS") || !Array.isArray(value)) continue;
      const list = (value as Asset[]).filter((a) => !seen.has(a.id));
      for (const a of list) seen.add(a.id);
      registerTileAssets(list);
      out.push(...list);
    }
  }
  return out;
}
