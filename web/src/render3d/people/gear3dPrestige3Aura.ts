/**
 * Prestige track 3's aura in 3D (`core/src/prestige.ts`, slot "aura"): Event-horizon ring. Like the cases'
 * (`gear3dAura.ts`) the builder gets a frame at the middle of the body, scaled to the avatar's height (one unit is one
 * metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by `gear3dPrestige3.ts`.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded } from "../kit/kit.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { isVox } from "./voxgear.ts";

const SPHERE = new THREE.SphereGeometry(0.5, 10, 8);
const CUBE = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
const BAND = new THREE.RingGeometry(0.3, 0.62, 40).rotateX(-Math.PI / 2);

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity: number, double = false): THREE.Material {
  const key = `${color}/${opacity}/${double}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** Geometry every wearer shares, by key. */
const geos = new Map<string, THREE.BufferGeometry>();

/** A ring of `n` cubes of `size` metres on a circle of radius `r`, lying flat, as one geometry. */
function cubeRing(r: number, n: number, size: number): THREE.BufferGeometry {
  const key = `cubering${r},${n},${size}`;
  let g = geos.get(key);
  if (!g) {
    const parts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return new THREE.BoxGeometry(size, size, size)
        .translate(Math.cos(a) * r, 0, Math.sin(a) * r)
        .toNonIndexed();
    });
    g = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    geos.set(key, g);
  }
  return g;
}
/** A thin flat ring of light: a torus when smooth, a ring of cubes when blocky. */
function thinRing(vox: boolean, r: number, tube: number, material: THREE.Material): THREE.Mesh {
  const key = `torus${r},${tube}`;
  let g = geos.get(key);
  if (!vox && !g) {
    g = new THREE.TorusGeometry(r, tube, 5, 56).rotateX(Math.PI / 2);
    geos.set(key, g);
  }
  const o = new THREE.Mesh(vox ? cubeRing(r, Math.round(r * 110), Math.max(0.02, tube * 2.6)) : g!, material);
  o.userData.noBlock = true;
  return o;
}

const MAGENTA = "#d946ef";
const PINK = "#ff7cf5";
const WHITE = "#ffeafd";

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Event-horizon ring: a pool of dark where the wearer stands; round the waist a tilted disc of fire, a hot ring with a
// wide haze, three hot spots racing along it each trailing sparks; round the whole body two rings of bent light that
// turn slowly against each other; and motes that spiral in from the dark, brightening as they fall, gone at the middle.
AURA_BUILDERS["Event-horizon ring"] = (m, tick) => {
  const vox = isVox(m);
  const geo = vox ? CUBE : SPHERE;
  const rnd = seeded(703);
  const add = (o: THREE.Object3D, parent: THREE.Object3D = m) => {
    o.userData.noBlock = true;
    parent.add(o);
    return o;
  };
  const mesh = (g: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = m) =>
    add(new THREE.Mesh(g, mat), parent) as THREE.Mesh;

  // The pool of dark underfoot, a ring of light at its edge, and a faint dark halo round the body.
  const pool = mesh(vox ? CUBE : DISC, basic("#07030f", 0.55));
  pool.position.y = -0.49;
  pool.scale.set(0.9, 0.006, 0.9);
  const poolEdge = thinRing(vox, 0.45, 0.006, basic(MAGENTA, 0.55));
  poolEdge.position.y = -0.485;
  add(poolEdge);

  // The disc, tilted, its hot ring, its haze and its two faint outer rings.
  const disc = new THREE.Group();
  disc.position.y = -0.02;
  add(disc);
  const haze = mesh(vox ? cubeRing(0.5, 36, 0.03) : BAND, basic(MAGENTA, vox ? 0.35 : 0.2, true), disc);
  haze.scale.setScalar(1);
  add(thinRing(vox, 0.46, 0.012, basic(PINK, 0.95)), disc);
  add(thinRing(vox, 0.58, 0.006, basic(MAGENTA, 0.6)), disc);
  add(thinRing(vox, 0.34, 0.005, basic(WHITE, 0.55)), disc);
  const spots = [0, 1, 2].flatMap((i) => {
    const head = mesh(geo, basic(i === 0 ? WHITE : PINK, 1), disc);
    head.scale.setScalar(i === 0 ? 0.05 : 0.036);
    const trail = [1, 2, 3, 4].map((j) => {
      const o = mesh(geo, basic(j < 3 ? PINK : MAGENTA, 0.8 - j * 0.14), disc);
      o.scale.setScalar(0.03 - j * 0.004);
      return o;
    });
    return [{ head, trail, a: (i / 3) * Math.PI * 2, r: [0.46, 0.58, 0.34][i]!, s: [1.5, 1.05, 2.1][i]! }];
  });

  // The two rings of bent light round the body, one turning against the other.
  const gyro = new THREE.Group();
  add(gyro);
  const halos = [0, 1].map((i) => {
    const holder = new THREE.Group();
    holder.rotation.set(Math.PI / 2 + (i ? 0.5 : -0.5), 0, i ? 0.4 : -0.3);
    gyro.add(holder);
    const r = thinRing(vox, 0.63 + i * 0.03, 0.006, basic(i ? PINK : MAGENTA, 0.5));
    holder.add(r);
    // A bright knot on each, riding round it.
    const knot = mesh(geo, basic(WHITE, 0.95), holder);
    knot.scale.setScalar(0.03);
    return { holder, knot, r: 0.63 + i * 0.03, a: i * 2 };
  });

  // Motes spiralling in toward the dark.
  const motes = Array.from({ length: 16 }, (_, i) => {
    const o = mesh(geo, basic(i % 3 ? MAGENTA : PINK, 0.9));
    return {
      o,
      p: i / 16 + rnd() * 0.03,
      a: rnd() * Math.PI * 2,
      y: (rnd() - 0.5) * 0.9,
      s: 0.8 + rnd() * 0.4,
    };
  });
  const cubes = vox ? 0.85 : 1;

  tick((t, walking) => {
    const pace = walking ? 1.5 : 1;
    // The disc wobbles on its tilt as if it were turning slowly through the dark.
    disc.rotation.set(0.2 + Math.sin(t * 0.5) * 0.08, t * 0.12, Math.cos(t * 0.4) * 0.07);
    haze.rotation.y = t * 0.2;
    for (const s of spots) {
      const a = s.a + t * s.s * pace;
      s.head.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
      s.trail.forEach((o, j) => {
        const b = a - (j + 1) * 0.16;
        o.position.set(Math.cos(b) * s.r, 0, Math.sin(b) * s.r);
      });
    }
    gyro.rotation.y = t * 0.3 * pace;
    for (const [i, h] of halos.entries()) {
      h.holder.rotation.y = t * (i ? -0.5 : 0.4);
      const a = h.a + t * (i ? 1.3 : 1.7);
      h.knot.position.set(Math.cos(a) * h.r, 0, Math.sin(a) * h.r);
    }
    poolEdge.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03);
    for (const mt of motes) {
      const k = (t * 0.09 * mt.s * pace + mt.p) % 1;
      // In from beyond the rings to the middle, the turn quickening as it falls.
      const r = 0.72 * (1 - k) ** 1.2 + 0.05;
      const a = mt.a + t * 0.3 + k * k * 9;
      mt.o.position.set(Math.cos(a) * r, mt.y * (1 - k * 0.7), Math.sin(a) * r);
      const size = 0.032 * smooth(0, 0.08, k) * (1 - smooth(0.9, 1, k)) * cubes;
      mt.o.scale.setScalar(Math.max(0.0005, size));
      mt.o.visible = size > 0.002;
    }
  });
};
