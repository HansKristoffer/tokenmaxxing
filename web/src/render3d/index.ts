import type { Renderer } from "../game/renderer.ts";

/**
 * The 3D renderer's entry, loaded on demand (`loadRenderer`) so Three.js is never downloaded on the Low
 * tier. Return a `Renderer` (see `game/renderer.ts`), or null when 3D isn't available: the game then runs
 * on 2D. Throwing (a shader error, a lost context) also falls back, with a toast.
 */
export function create3D(): Renderer | null {
  return null;
}
