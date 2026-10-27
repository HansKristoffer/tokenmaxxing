/**
 * The Night Market case's four legendary auras in 3D (`core/src/case.ts`, slot "aura"): effects that move around
 * the wearer rather than sit on them. Each builder gets a frame at the middle of the body, scaled to the avatar's
 * height (one unit is one metre of a 0.95 m person), and registers a tick that moves its cubes. Loaded by
 * `gear3d.ts`. The 2D art is in `art/case-aura.ts`.
 */
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { lit, see } from "./gear3dHead.ts";

type Tick = (t: number, walking: boolean) => void;
export type AuraBuilder = (m: THREE.Object3D, tick: (fn: Tick) => void) => void;
export const AURA_BUILDERS: Record<string, AuraBuilder> = {};

const CUBE = new THREE.BoxGeometry(1, 1, 1);
/** A cube of `w`×`h`×`d` metres (it moves and scales, and stays out of the blocky swap). */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
) {
  const o = new THREE.Mesh(CUBE, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}
/** A glowing cube with a soft see-through one round it. */
function glowing(parent: THREE.Object3D, size: number, core: string, halo: string, haloOpacity = 0.3) {
  const g = new THREE.Group();
  parent.add(g);
  cube(g, [size, size, size], lit(core));
  cube(g, [size * 2.4, size * 2.4, size * 2.4], see(halo, haloOpacity, true));
  return g;
}
const BASE = -0.5; // feet, from the middle of the body

// Lantern Sky: six paper lanterns drift round in a slow ring, bobbing, each a warm glow.
AURA_BUILDERS["Lantern Sky"] = (m, tick) => {
  const lanterns = Array.from({ length: 6 }, (_, i) => {
    const g = new THREE.Group();
    m.add(g);
    cube(g, [0.075, 0.095, 0.075], lit(i % 2 ? "#ff9a3c" : "#ff7a2e"));
    cube(g, [0.05, 0.06, 0.05], lit("#ffe0a0"));
    cube(g, [0.08, 0.016, 0.08], lit("#6b2418"), [0, 0.056, 0]);
    cube(g, [0.08, 0.016, 0.08], lit("#6b2418"), [0, -0.056, 0]);
    cube(g, [0.004, 0.05, 0.004], lit("#6b2418"), [0, 0.1, 0]);
    cube(g, [0.17, 0.2, 0.17], see("#ffb347", 0.2, true));
    return g;
  });
  tick((t, walking) => {
    lanterns.forEach((g, i) => {
      const a = t * (walking ? 0.6 : 0.42) + (i / lanterns.length) * Math.PI * 2;
      const r = 0.43 + Math.sin(t * 0.7 + i * 2) * 0.03;
      g.position.set(
        Math.cos(a) * r,
        0.02 + (i % 3) * 0.2 - 0.2 + Math.sin(t * 1.1 + i * 1.7) * 0.07,
        Math.sin(a) * r,
      );
      g.rotation.y = -a;
      g.scale.setScalar(1 + Math.sin(t * 7 + i * 3) * 0.05);
    });
  });
};

// Sakura Storm: pink petals whirl up in a spiral and then drift down to settle round the feet.
AURA_BUILDERS["Sakura Storm"] = (m, tick) => {
  const rnd = seeded(77);
  const pinks = ["#ffb3cf", "#ff8fb8", "#ffd1e2", "#f77aa6"];
  const petals = Array.from({ length: 22 }, (_, i) => ({
    o: cube(m, [0.055, 0.012, 0.04], lit(pinks[i % pinks.length]!)),
    p: rnd(),
    r: 0.3 + rnd() * 0.16,
    s: 0.8 + rnd() * 0.5,
    spin: rnd() * 6,
  }));
  tick((t) => {
    for (const p of petals) {
      const k = (t * 0.1 * p.s + p.p) % 1;
      // Up fast with the wind, then down slowly: the swirl slows as it settles.
      const lift = k < 0.45 ? Math.sin((k / 0.45) * (Math.PI / 2)) : 1 - ((k - 0.45) / 0.55) ** 1.6;
      const a = (k < 0.45 ? k * 11 : 4.95 + (k - 0.45) * 3) + p.p * 6.28 + t * 0.35;
      const r = p.r * (k < 0.45 ? 0.7 + 0.3 * Math.sin((k / 0.45) * Math.PI) : 1);
      p.o.position.set(Math.cos(a) * r, BASE + 0.02 + lift * 1.05, Math.sin(a) * r);
      p.o.rotation.set(t * 2 + p.spin, t * 1.4 + p.spin, t * 1.7);
      const z = k > 0.97 ? 0.001 : 1.15;
      p.o.scale.set(0.055 * z, 0.012 * z, 0.04 * z);
    }
  });
};

// Firefly Swarm: small green-gold lights wander round the wearer and blink on and off.
AURA_BUILDERS["Firefly Swarm"] = (m, tick) => {
  const rnd = seeded(31);
  const flies = Array.from({ length: 15 }, (_, i) => ({
    g: glowing(m, 0.04, i % 3 ? "#d8ff5a" : "#ffe45e", i % 3 ? "#9be24a" : "#ffd84a", 0.32),
    ax: 0.28 + rnd() * 0.2,
    ay: 0.3 + rnd() * 0.25,
    fx: 0.25 + rnd() * 0.35,
    fy: 0.3 + rnd() * 0.4,
    fz: 0.2 + rnd() * 0.4,
    p: rnd() * 20,
    blink: 0.9 + rnd() * 1.3,
  }));
  tick((t) => {
    for (const f of flies) {
      const u = t + f.p;
      f.g.position.set(
        Math.sin(u * f.fx) * f.ax * 1.2,
        Math.sin(u * f.fy) * f.ay + 0.05,
        Math.cos(u * f.fz) * f.ax * 1.2,
      );
      const b = Math.max(0, Math.sin(u * f.blink * 2.2));
      f.g.scale.setScalar(0.1 + b ** 0.5 * 1.1);
    }
  });
};

// Koi Current: a ribbon of tiny koi follows one another round the wearer on a rolling ring, tails flicking.
AURA_BUILDERS["Koi Current"] = (m, tick) => {
  const skins: [string, string][] = [
    ["#ff7a2a", "#fff1e0"],
    ["#fff4e8", "#e8452a"],
    ["#ffb03a", "#fff4e8"],
  ];
  const koi = Array.from({ length: 10 }, (_, i) => {
    const g = new THREE.Group();
    g.scale.setScalar(1.35);
    m.add(g);
    const [main, patch] = skins[i % skins.length]!;
    cube(g, [0.09, 0.04, 0.036], lit(main));
    cube(g, [0.036, 0.042, 0.038], lit(patch), [0.01, 0.004, 0]);
    cube(g, [0.03, 0.03, 0.03], lit(main), [0.06, 0, 0]);
    cube(g, [0.012, 0.012, 0.012], lit("#2a1a14"), [0.066, 0.012, 0.016]);
    cube(g, [0.012, 0.012, 0.012], lit("#2a1a14"), [0.066, 0.012, -0.016]);
    cube(g, [0.01, 0.03, 0.07], lit(patch), [0, 0.03, 0]);
    const tail = new THREE.Group();
    tail.position.set(-0.045, 0, 0);
    g.add(tail);
    cube(tail, [0.04, 0.012, 0.05], lit(patch), [-0.02, 0, 0]);
    cube(g, [0.04, 0.05, 0.05], see("#9fe9ff", 0.16, true));
    return { g, tail };
  });
  tick((t, walking) => {
    koi.forEach(({ g, tail }, i) => {
      const a = t * (walking ? 1.1 : 0.8) - i * 0.34;
      const r = 0.42;
      g.position.set(Math.cos(a) * r, Math.sin(a * 2 + t * 0.6) * 0.16 + 0.05, Math.sin(a) * r);
      g.rotation.y = -a - Math.PI / 2;
      g.rotation.z = Math.cos(a * 2 + t * 0.6) * 0.35;
      tail.rotation.y = Math.sin(t * 9 + i) * 0.6;
    });
  });
};
