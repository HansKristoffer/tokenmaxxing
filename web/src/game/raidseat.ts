import { canSit, ownSeatAt } from "@tokenmaxxing/core/raidseat.ts";
import { seatTile } from "./raid.ts";
import { self, world } from "./world.ts";

/**
 * Sitting at your own war desk in the Raid Dungeon. It is only what you see: the server doesn't know (the
 * dungeon's seats are the client's, `setRaiders`), so you stay on your tile as far as everyone else is
 * concerned. While seated the 3D game draws your own body at the seat, and the clone that was there is hidden
 * (`DungeonLive`); your pet's shots start from wherever it stands (`petAt`, set by `Entities`).
 */
const state = { sitting: false, room: null as string | null };

/** Where your pet is drawn in the room (world x, z), while it is: the raid fires its little missiles from there. */
export const raidPet = { at: null as [number, number] | null };

/** Your seat's tile, if you are in the dungeon and have one. */
export function mySeat(): [number, number] | null {
  return world.room === "dungeon" ? seatTile(world.selfId) : null;
}

/** Whether you are sitting at your seat now (it stands you up when the room, the raid or your seat is gone). */
export function seated(): boolean {
  if (!state.sitting) return false;
  if (state.room !== world.room || mySeat() === null) state.sitting = false;
  return state.sitting;
}

/** The seat tile you are drawn on, while you sit. */
export function seatedAt(): [number, number] | null {
  return seated() ? mySeat() : null;
}

export function standUp(): void {
  state.sitting = false;
}

/** Whether E on the tile (`x`, `y`) takes your seat. */
export function sitsAt(x: number, y: number): boolean {
  const me = self();
  return !!me && canSit(world.room, mySeat(), me.state) && ownSeatAt(mySeat(), x, y);
}

/** E on your own clone or its desk: sits you down. False when that isn't your seat (nothing happens). */
export function sit(x: number, y: number): boolean {
  if (!sitsAt(x, y)) return false;
  state.sitting = true;
  state.room = world.room;
  return true;
}
