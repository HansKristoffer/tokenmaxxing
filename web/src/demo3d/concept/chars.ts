/** Voxel people and pets, scattered on terraces, bridges and the plaza (they reuse avatar.ts / pets3d.ts). */
import type * as THREE from "three";
import { Avatar, type Look, randomLook } from "../avatar.ts";
import { seeded } from "../kit.ts";
import { type Pet3D, petFrom2D } from "../pets3d.ts";
import type { World } from "./scene.ts";

const NEON_FITS: [string, string][] = [
  ["#ff3d9a", "#2b2f4a"],
  ["#2fe0ff", "#241a3a"],
  ["#ffb347", "#1e2230"],
  ["#9b6bff", "#20243a"],
  ["#e8f0ff", "#2a1f3a"],
];

export interface Crowd {
  avatars: Avatar[];
  pets: Pet3D[];
}

export function person(rnd: () => number, cyber: boolean): Avatar {
  const look: Look = randomLook(rnd);
  if (cyber) {
    look.outfit = NEON_FITS[Math.floor(rnd() * NEON_FITS.length)]!;
    look.pants = "#1d2033";
    if (rnd() < 0.5) look.hat = "none";
  }
  const a = new Avatar(look, "voxel");
  a.pose = rnd() < 0.7 ? "walk" : "stand";
  a.update(rnd() * 2, rnd() * 5);
  return a;
}

export function pet(rnd: () => number): Pet3D {
  const species = [1, 2, 2, 3, 3, 5, 4][Math.floor(rnd() * 7)]!;
  const p = petFrom2D(species, Math.floor(rnd() * 3));
  p.moving = rnd() < 0.5;
  p.update(rnd() * 3);
  return p;
}

/** Put `people` avatars and `pets` pets on cleared roofs (and a few on `extra` spots). */
export function populate(
  world: World,
  people: number,
  pets: number,
  extra: [number, number, number][] = [],
  seed = 3,
): Crowd {
  const rnd = seeded(seed);
  const cyber = world.theme === "cyber";
  const avatars: Avatar[] = [];
  const petList: Pet3D[] = [];
  const spots = world.city.roofs.filter((r) => r.clear);
  const place = (o: THREE.Object3D, x: number, y: number, z: number) => {
    o.position.set(x, y, z);
    o.rotation.y = rnd() * Math.PI * 2;
    world.content.add(o);
  };
  for (let k = 0; k < people; k++) {
    const a = person(rnd, cyber);
    avatars.push(a);
    if (k < extra.length) {
      const e = extra[k]!;
      place(a.root, e[0], e[1], e[2]);
    } else {
      const s = spots[Math.floor(rnd() * spots.length)];
      if (!s) continue;
      place(a.root, s.x + (rnd() - 0.5) * 1.8, s.y, s.z + (rnd() - 0.5) * 1.8);
    }
  }
  for (let k = 0; k < pets; k++) {
    const p = pet(rnd);
    petList.push(p);
    const s = spots[Math.floor(rnd() * spots.length)];
    if (!s) continue;
    place(p.root, s.x + (rnd() - 0.5) * 1.8, s.y, s.z + (rnd() - 0.5) * 1.8);
  }
  return { avatars, pets: petList };
}

/** A little crowd standing or walking about on one level, round (cx, cz). */
export function crowdAt(
  world: World,
  cx: number,
  cz: number,
  y: number,
  n: number,
  rx: number,
  rz: number,
  seed = 8,
  pets = 0,
): void {
  const rnd = seeded(seed);
  const cyber = world.theme === "cyber";
  for (let k = 0; k < n; k++) {
    const a = person(rnd, cyber);
    a.root.position.set(cx + (rnd() - 0.5) * 2 * rx, y, cz + (rnd() - 0.5) * 2 * rz);
    a.root.rotation.y = rnd() * Math.PI * 2;
    world.content.add(a.root);
  }
  for (let k = 0; k < pets; k++) {
    const p = pet(rnd);
    p.root.position.set(cx + (rnd() - 0.5) * 2 * rx, y, cz + (rnd() - 0.5) * 2 * rz);
    p.root.rotation.y = rnd() * Math.PI * 2;
    world.content.add(p.root);
  }
}
