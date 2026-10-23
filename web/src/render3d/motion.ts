import type { Facing, PlayerState } from "@tokenmaxxing/core/world.ts";
import type { Pose } from "../demo3d/avatar.ts";

/** Pure movement and pose rules for the 3D people, kept apart from three.js so they can be tested. */

/** Which way each facing turns a character (they face +z, "down" the map, at yaw 0). */
export const YAW: Record<Facing, number> = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };

/** The shortest signed turn from `from` to `to`, in radians. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Eases `from` toward `to` over `tau` ms: frame-rate independent, never overshoots. */
export function approach(from: number, to: number, dtMs: number, tauMs: number): number {
  return from + (to - from) * (1 - Math.exp(-dtMs / tauMs));
}

/** Turns toward `to` over `tauMs`, the short way round. */
export function turnToward(yaw: number, to: number, dtMs: number, tauMs: number): number {
  return yaw + angleDelta(yaw, to) * (1 - Math.exp(-dtMs / tauMs));
}

/** How high the seat is above the floor, by what the legend calls it. */
export const SEAT_HEIGHT: Record<string, number> = { bench: 0.31, chair: 0.33, sofa: 0.36, bed: 0.3 };

export interface Posing {
  state: PlayerState;
  dozing: boolean;
}

export interface PoseOut {
  pose: Pose;
  /** Lying down: in a bed, or on a sleeping bag. */
  lying: boolean;
  /** The seat (or bed) they are on, if any. */
  seat: string | undefined;
}

/**
 * The pose for someone in the 2D game's states (`render.ts drawAvatar`): `away` and a bed lie down,
 * `working` types at the desk, a seat sits, everyone else stands or walks. `seat` is the legend's seat kind
 * under them and `walking` whether they are between tiles.
 */
export function poseOf(p: Posing, seat: string | undefined, walking: boolean): PoseOut {
  const lying = p.state === "away" || (p.state === "sit" && seat === "bed");
  if (lying) return { pose: "sleep", lying: true, seat };
  if (p.state === "working") return { pose: "type", lying: false, seat };
  if (p.state === "sit") return { pose: "sit", lying: false, seat };
  return { pose: walking ? "walk" : "stand", lying: false, seat };
}

/**
 * A hop's height in world units, `t` being how far through it (0 to 1; past 1 is none). The 2D game's
 * seven pixels of a sixteen-pixel tile.
 */
export function hopHeight(t: number): number {
  return t >= 0 && t < 1 ? Math.sin(t * Math.PI) * 0.44 : 0;
}

/** Whether a position changed enough in a frame to count as walking (tiles a second). */
export function isMoving(dx: number, dz: number, dtMs: number, minTilesPerSec = 0.6): boolean {
  return dtMs > 0 && Math.hypot(dx, dz) / (dtMs / 1000) > minTilesPerSec;
}

/**
 * The grid direction a key means when the camera looks from `quarter` quarter-turns round from the default
 * (`quarter` 0 keeps the 2D game's: Up walks up the map). Each key keeps the screen diagonal it has at 0, so
 * turning the view doesn't turn the keys against you.
 */
const VECTOR: Record<Facing, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
/** Each key's place on screen at quarter 0: [right, up]. */
const SCREEN: Record<Facing, [number, number]> = { up: [1, 1], right: [1, -1], down: [-1, -1], left: [-1, 1] };

export function keyDirection(key: Facing, quarter: number, base = Math.PI / 4): Facing {
  const az = base + (quarter * Math.PI) / 2;
  const right: [number, number] = [Math.cos(az), -Math.sin(az)];
  const away: [number, number] = [-Math.sin(az), -Math.cos(az)];
  let best: Facing = key;
  let score = -Infinity;
  for (const dir of Object.keys(VECTOR) as Facing[]) {
    const [vx, vz] = VECTOR[dir];
    const sx = vx * right[0] + vz * right[1];
    const sy = vx * away[0] + vz * away[1];
    const d = sx * SCREEN[key][0] + sy * SCREEN[key][1];
    if (d > score + 1e-6) {
      score = d;
      best = dir;
    }
  }
  return best;
}
