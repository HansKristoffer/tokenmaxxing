import type { FishingCast } from "@tokenmaxxing/core/fishing.ts";
import { hud } from "../store.ts";
import { self, world } from "./world.ts";

let line: FishingCast | null = null;
export const setFishingLine = (cast: FishingCast | null): void => {
  line = cast;
};
export function fishingLine(): FishingCast | null {
  const me = self();
  return line &&
    world.room === "town" &&
    me?.x === line.x &&
    me.y === line.y &&
    hud.get().panel?.kind === "fishing"
    ? line
    : null;
}
