/**
 * Prestige track 5's hat, outfit, back item and aura in 3D (`core/src/prestige.ts`): Prismatic. Loaded by
 * `gear3dPrestige.ts`, it adds the Prismatic crown to the shop's `HAT_BUILDERS` by name, and pulls in the body
 * (`gear3dPrestige5Body.ts`: the regalia and the Aurora wings) and aura (`gear3dPrestige5Aura.ts`) halves. Same
 * frames as `gear3dHead.ts`: the head frame has its origin at the skull's centre, +z is the face and +y up; a voxel
 * head draws every ball as a cube.
 */
import * as THREE from "three";
import type { Model } from "../kit/kit.ts";
import { shimmer } from "./gear3dPrestige5Aura.ts";
import "./gear3dPrestige5Body.ts";
import { band, COVERS_HAIR, type Ctx, HAT_BUILDERS, lit } from "./gear3dHead.ts";
import { isVox } from "./voxgear.ts";

const PEARL = "#f4f0ff";
const PEARL_SHADE = "#cfc6ea";
const PINK = "#ff7ad9";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: Model, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

/**
 * A pearl crown of seven points, a gem on each that walks round the whole spectrum, a band of pearl with fourteen
 * stones set round it and a pink one at the front, and a small prism turning above it, throwing light.
 */
function prismaticCrown(m: Model, c: Ctx): void {
  const vox = isVox(m);
  // Clear the voxel character's taller hair.
  const up = vox ? 0.1 : 0;
  const y = 0.16 + up;
  band(m, PEARL, 0.235, 0.07, y, 0.24);
  band(m, PEARL_SHADE, 0.241, 0.014, y);
  band(m, PINK, 0.243, 0.01, y + 0.06);

  // Every gem is its own lit material, so each can run round the spectrum from where it starts.
  const gems: { mat: THREE.Material; at: number }[] = [];
  const gem = (at: number) => {
    const mat = lit("#ffffff");
    gems.push({ mat, at });
    shimmer(mat, at, 0);
    return mat;
  };
  // The points, the front one the tallest, a gem on each.
  const N = 7;
  for (let i = 0; i < N; i++) {
    const [x, z] = roundAt(m, (i / N) * Math.PI * 2, 0.232);
    const h = i === 0 ? 0.17 : 0.1 + (i % 2) * 0.04;
    m.cyl(0.042, h, PEARL, [x, y + 0.06, z], 0.008, 5);
    m.ball(0.02, gem(i / N), [x, y + 0.06 + h + 0.008, z], [1, 1, 1], 8);
  }
  // Stones round the band, a spectrum a lap, and a pink one at the front.
  for (let i = 0; i < 14; i++) {
    const [x, z] = roundAt(m, ((i + 0.5) / 14) * Math.PI * 2, 0.247);
    m.box([0.034, 0.022, 0.034], gem(i / 14), [x, y + 0.022, z], 0);
  }
  m.box([0.05, 0.05, 0.026], PINK, [0, y + 0.01, 0.26], 0.004);
  m.box([0.024, 0.024, 0.03], "#ffffff", [0, y + 0.023, 0.265], 0);

  // The prism over it: a diamond of stepped boxes that turns and glints through the spectrum.
  const prism = m.part([0, y + 0.36, 0]);
  const core = lit("#ffffff");
  for (const [w, h, yy] of [
    [0.03, 0.03, -0.045],
    [0.075, 0.03, -0.015],
    [0.075, 0.03, 0.015],
    [0.03, 0.03, 0.045],
  ] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), core);
    b.position.y = yy;
    b.userData.noBlock = true;
    prism.add(b);
  }
  c.tick((t) => {
    for (const g of gems) shimmer(g.mat, g.at, t);
    shimmer(core, 0.5, t * 1.5, 0.85);
    prism.rotation.y = t * 1.2;
    prism.position.y = y + 0.36 + Math.sin(t * 1.8) * 0.014;
  });
}

Object.assign(HAT_BUILDERS, {
  "Prismatic crown": (m: Model, c: Ctx) => prismaticCrown(m, c),
});
COVERS_HAIR.add("Prismatic crown");
