/**
 * Prestige track 1's aura in 3D (`core/src/prestige.ts`, slot "aura"): Ascending sparks. Like the cases' and the
 * pond's (`gear3dAura.ts`, `gear3dFishingAura.ts`) the builder gets a frame at the middle of the body, scaled to the
 * avatar's height (one unit is one metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by
 * `gear3dPrestige1.ts`; the 2D art is in `art/prestige-1.ts`.
 */
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { isVox } from "./voxgear.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);
const TAU = Math.PI * 2;

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity = 1): THREE.Material {
  const key = `${color}/${opacity}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** A unit cube that moves and scales and stays out of the blocky swap. */
function cube(parent: THREE.Object3D, mat: THREE.Material, at?: [number, number, number]): THREE.Mesh {
  const o = new THREE.Mesh(CUBE, mat);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Ascending sparks: motes of violet light lift off the feet and climb round the wearer, brightening to silver and
// never coming down; feathers of light, each a small leaning blade, rise on a wider lap; a halo of light beats over
// the head, and a ring of light swells out from the feet and fades, over and over.
AURA_BUILDERS["Ascending sparks"] = (m, tick) => {
  const vox = isVox(m);
  const rnd = seeded(700);
  const tones = ["#c4a8ff", "#8b5cf6", "#d6dbe6", "#a982ff", "#ffffff"];
  const N = 26;
  const motes = Array.from({ length: N }, (_, i) => {
    const o = cube(m, basic(tones[i % tones.length]!, 0.9));
    return {
      o,
      p: i / N + (rnd() - 0.5) * 0.03,
      a: rnd() * TAU,
      r: 0.22 + rnd() * 0.22,
      d: 0.014 + rnd() * 0.016,
      s: 0.9 + rnd() * 0.4,
    };
  });
  const feathers = Array.from({ length: 5 }, (_, i) => {
    const g = new THREE.Group();
    m.add(g);
    cube(g, basic("#ffffff", 0.9)).scale.set(0.012, 0.07, 0.006);
    cube(g, basic("#c4a8ff", 0.8), [0, -0.05, 0]).scale.set(0.02, 0.04, 0.006);
    cube(g, basic("#8b5cf6", 0.8), [0, -0.085, 0]).scale.set(0.006, 0.03, 0.006);
    return { g, p: i / 5 + 0.1, a: rnd() * TAU, r: 0.4 + rnd() * 0.1, s: 0.8 + rnd() * 0.3 };
  });
  // The halo: a thin torus on smooth bodies, a square of cubes on blocky ones.
  const halo = new THREE.Group();
  halo.position.y = 0.6;
  m.add(halo);
  const haloMat = basic("#e6dcff", 0.85);
  if (vox) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      cube(halo, haloMat, [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2]).scale.setScalar(0.03);
    }
  } else {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 28), haloMat);
    t.rotation.x = Math.PI / 2;
    t.userData.noBlock = true;
    halo.add(t);
  }
  const rings = [0, 1].map(() => {
    const o = vox
      ? cube(m, basic("#8b5cf6", 0.4))
      : new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 4, 32), basic("#8b5cf6", 0.4));
    o.userData.noBlock = true;
    if (!vox) o.rotation.x = Math.PI / 2;
    m.add(o);
    return o;
  });
  const cubes = vox ? 0.85 : 1;
  tick((t, walking) => {
    const pace = walking ? 1.5 : 1;
    for (const b of motes) {
      const k = (t * 0.12 * b.s * pace + b.p) % 1;
      // From the feet (-0.5) to well over the head (0.65), swirling slowly round as it goes.
      const a = b.a + t * 0.5 + k * 3;
      const r = b.r + Math.sin(k * 6 + b.a) * 0.03;
      b.o.position.set(Math.sin(a) * r, -0.5 + k * 1.15, Math.cos(a) * r);
      const size = b.d * cubes * smooth(0, 0.08, k) * (1 - smooth(0.85, 1, k));
      b.o.scale.set(size, size * (1 + (1 - k) * 0.8), size);
      b.o.visible = size > 0.002;
    }
    for (const f of feathers) {
      const k = (t * 0.07 * f.s * pace + f.p) % 1;
      const a = f.a + t * 0.25 + k * 1.5;
      f.g.position.set(Math.sin(a) * f.r, -0.45 + k * 1.05, Math.cos(a) * f.r);
      f.g.rotation.set(0, a, Math.sin(t * 1.3 + f.a) * 0.25 - 0.3);
      f.g.scale.setScalar(Math.max(0.001, smooth(0, 0.1, k) * (1 - smooth(0.88, 1, k))));
    }
    const beat = 0.5 + 0.5 * Math.sin(t * 2.2);
    halo.scale.setScalar(0.95 + beat * 0.12);
    halo.position.y = 0.6 + Math.sin(t * 1.1) * 0.012;
    halo.rotation.y = t * 0.6;
    rings.forEach((o, i) => {
      const k = (t * 0.3 + i * 0.5) % 1;
      const r = 0.12 + k * 0.4;
      o.position.y = -0.5 + k * 0.04;
      if (vox) o.scale.set(r * 2, 0.012, r * 2);
      else o.scale.set(r / 0.5, r / 0.5, 1);
      o.visible = k < 0.92;
    });
  });
};
