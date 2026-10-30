/**
 * Prestige track 5's aura in 3D (`core/src/prestige.ts`, slot "aura"): Prismatic ascension. Like the cases'
 * (`gear3dAura.ts`, `gear3dRagnarokAura.ts`) the builder gets a frame at the middle of the body, scaled to the
 * avatar's height (one unit is one metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by
 * `gear3dPrestige5.ts`; the 2D art is in `art/prestige-5.ts`.
 */
import * as THREE from "three";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { isVox } from "./voxgear.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true);

/** The spectrum, as the 2D art spells it (`art/prestige-5.ts`): red, orange, yellow, green, cyan, blue, violet, pink. */
const SPECTRUM = ["#ff5d73", "#ff9a4d", "#ffe066", "#5df0a0", "#5fe0ff", "#6f9bff", "#a78bfa", "#ff7ad9"];

/** Sets a lit material to the spectrum `at` (0..1 round) plus the clock, `t`, so a gem walks through every colour. */
export const shimmer = (mat: THREE.Material, at: number, t: number, light = 0.68): void => {
  (mat as THREE.MeshBasicMaterial).color.setHSL((((at + t * 0.12) % 1) + 1) % 1, 0.95, light);
};

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity = 1, side: THREE.Side = THREE.FrontSide): THREE.Material {
  const key = `${color}/${opacity}/${side}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      side,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A cube of `w`×`h`×`d` metres that moves and scales and stays out of the blocky swap. */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
  geo: THREE.BufferGeometry = CUBE,
): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}

// Prismatic ascension: a faint pearl column stands round the wearer on a ring of pearl at the feet. Every colour of
// the spectrum climbs it in a helix of lit specks, and over the head the helix opens out and each colour peels away
// into its own ray, so the column splits to a rainbow at the top. A pearl glint flies up the column now and then.
AURA_BUILDERS["Prismatic ascension"] = (m, tick) => {
  const vox = isVox(m);
  const FEET = -0.5;
  const TOP = 0.62;
  // The column: a see-through pearl shell (a prism of cubes for the blocky avatar), and the pool of light under it.
  cube(m, [0.7, 1.05, 0.7], basic("#f4f0ff", 0.05, THREE.BackSide), [0, 0.02, 0], vox ? CUBE : CYL);
  const pool = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return cube(m, [0.035, 0.012, 0.035], basic(i % 2 ? "#f4f0ff" : "#9fe8ff", 0.8), [
      Math.sin(a) * 0.36,
      FEET + 0.01,
      Math.cos(a) * 0.36,
    ]);
  });
  // The helix: eight colours, five specks each, every one on its own lap of the climb.
  const SPECKS = 5;
  const specks = SPECTRUM.flatMap((color, c) =>
    Array.from({ length: SPECKS }, (_, j) => ({
      o: cube(m, [1, 1, 1], basic(color, 0.95)),
      c,
      p: (j + c * 0.11) / SPECKS,
      s: 0.9 + ((c * 7) % 5) * 0.05,
    })),
  );
  // The rays over the head: one a colour, fanned out, growing and fading in turn.
  const rays = SPECTRUM.map((color, i) => {
    const a = (i / SPECTRUM.length) * Math.PI * 2;
    return { o: cube(m, [0.014, 0.1, 0.014], basic(color, 0.9)), a, i };
  });
  const glint = cube(m, [0.06, 0.06, 0.06], basic("#ffffff", 0.9));
  tick((t, walking) => {
    const pace = walking ? 1.5 : 1;
    for (const sp of specks) {
      const k = (t * 0.14 * sp.s * pace + sp.p) % 1;
      const y = FEET + k * (TOP - FEET);
      // Up the column in a helix, one colour to a strand, then out and away over the head.
      const open = smooth(0.62, 1, k);
      const r = 0.27 + open * 0.3;
      const a = (sp.c / SPECTRUM.length) * Math.PI * 2 + k * 5.5 + t * 0.5;
      sp.o.position.set(Math.sin(a) * r, y + open * 0.06, Math.cos(a) * r);
      const size = 0.026 * smooth(0, 0.08, k) * (1 - smooth(0.92, 1, k)) * (vox ? 0.85 : 1);
      sp.o.scale.set(Math.max(size, 0.0001), Math.max(size * 2.2, 0.0001), Math.max(size, 0.0001));
    }
    for (const r of rays) {
      const pulse = (Math.sin(t * 2.2 - r.i * 0.8) + 1) / 2;
      const len = 0.08 + pulse * 0.16;
      // Each ray leans out from the head at its own angle, tilted up.
      r.o.position.set(
        Math.sin(r.a) * (0.1 + len * 0.45),
        TOP + 0.12 + len * 0.4,
        Math.cos(r.a) * (0.1 + len * 0.45),
      );
      r.o.scale.set(0.014, len, 0.014);
      r.o.rotation.set(Math.cos(r.a) * 0.9, 0, -Math.sin(r.a) * 0.9);
    }
    const g = (t * 0.22) % 1;
    glint.position.set(Math.sin(t * 1.3) * 0.33, FEET + g * (TOP - FEET), Math.cos(t * 1.3) * 0.33);
    glint.rotation.y = t * 3;
    glint.scale.setScalar(0.05 * Math.sin(g * Math.PI) ** 2 + 0.0001);
    pool.forEach((p, i) => {
      p.scale.y = 0.012 + (Math.sin(t * 2 + i) + 1) * 0.004;
    });
  });
};
