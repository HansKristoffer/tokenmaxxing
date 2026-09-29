import { TILE } from "@tokenmaxxing/core/world.ts";
import { type Avatar, world } from "./world.ts";

/** Each pet's spot in world pixels (top-left). It trails its owner rather than sticking to them. */
const pets = new Map<number, { x: number; y: number; left: boolean; moving: boolean }>();

/** Moves `a`'s pet toward its spot: behind them while they walk, beside them while they rest. */
export function followPet(a: Avatar, px: number, py: number, dt: number) {
  if (!a.info.look.pet) return null;
  const resting = a.state !== "idle";
  const [tx, ty] = resting
    ? [px + 13, py + 6]
    : a.facing === "right"
      ? [px - 9, py + 6]
      : a.facing === "left"
        ? [px + 13, py + 6]
        : a.facing === "down"
          ? [px + 2, py - 4]
          : [px + 2, py + 13];
  let pet = pets.get(a.info.id);
  // New, or the owner jumped (a door, a warp): appear at the spot.
  if (!pet || Math.hypot(tx - pet.x, ty - pet.y) > 3 * TILE) {
    pet = { x: tx, y: ty, left: a.facing === "left", moving: false };
    pets.set(a.info.id, pet);
  }
  const k = 1 - Math.exp(-dt / 140);
  const dx = (tx - pet.x) * k;
  pet.x += dx;
  pet.y += (ty - pet.y) * k;
  pet.moving = Math.hypot(tx - pet.x, ty - pet.y) > 1;
  // Face where it's going; at rest, face its owner.
  if (Math.abs(dx) > 0.05) pet.left = dx < 0;
  else if (resting) pet.left = true;
  return pet;
}

/** Drops the pets of people who left the room. */
export function prunePets(): void {
  for (const id of pets.keys()) if (!world.avatars.has(id)) pets.delete(id);
}
