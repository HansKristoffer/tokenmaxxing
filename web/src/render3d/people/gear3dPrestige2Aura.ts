/**
 * Prestige track 2's legendary aura in 3D (`core/src/prestige.ts`, slot "aura"): Orbiting token sigil. Like the cases'
 * (`gear3dAura.ts`) the builder gets a frame at the middle of the body, scaled to the avatar's height (one unit is one
 * metre of a 0.95 m person), and registers a tick that moves its parts. Loaded by `gear3dPrestige2.ts`; the 2D art is
 * in `art/prestige-2.ts`.
 */
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import { AURA_BUILDERS } from "./gear3dAura.ts";
import { isVox } from "./voxgear.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);
const DISC = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);

const CYAN = "#22d3ee";
const GLOW = "#8cf0ff";
const PALE = "#d8fbff";
const DEEP = "#0e8aa6";

/** Materials every wearer shares: one per colour and opacity, never disposed with a model. */
const shared = new Map<string, THREE.Material>();
function basic(color: string, opacity = 1): THREE.Material {
  const key = `${color}/${opacity}`;
  let m = shared.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    m.userData.shared = true;
    shared.set(key, m);
  }
  return m;
}

/** A piece of the aura: it moves and scales and stays out of the blocky swap. */
function bit(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.userData.noBlock = true;
  parent.add(o);
  return o;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Orbiting token sigil: a ring of cyan dashes with four rune ticks inside it turns slowly round the wearer on a tilted
// plane, a thin orbit crosses it at another angle with three coin-like tokens riding it (each turning over as it goes,
// with a short fading trail), and a few stars twinkle further out.
AURA_BUILDERS["Orbiting token sigil"] = (m, tick) => {
  const vox = isVox(m);
  const coin = vox ? CUBE : DISC;
  const rnd = seeded(702);

  // The sigil: the group is tipped, and its dashes turn inside it about its own axis.
  const sigil = new THREE.Group();
  sigil.rotation.set(0.32, 0, -0.12);
  m.add(sigil);
  const spin = new THREE.Group();
  sigil.add(spin);
  const R = 0.46;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const d = bit(spin, CUBE, basic(i % 2 ? CYAN : GLOW));
    d.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    d.rotation.y = -a;
    d.scale.set(0.012, 0.012, 0.11);
    // A faint cap at each end of a dash.
    for (const s of [-1, 1]) {
      const c = bit(d, CUBE, basic(PALE));
      c.position.set(0, 0, s * 0.5);
      c.scale.set(1.4, 1.4, 0.12);
    }
  }
  // Ticks inside the ring, a counter-turning inner wheel.
  const wheel = new THREE.Group();
  sigil.add(wheel);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const t = bit(wheel, CUBE, basic(CYAN, 0.8));
    t.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
    t.rotation.y = -a;
    t.scale.set(0.01, 0.01, 0.05);
    const dot = bit(wheel, CUBE, basic(GLOW, 0.8));
    dot.position.set(Math.cos(a + 0.5) * 0.36, 0, Math.sin(a + 0.5) * 0.36);
    dot.scale.setScalar(0.014);
  }

  // The orbit and its tokens, on a plane tipped the other way.
  const orbit = new THREE.Group();
  orbit.rotation.set(-0.5, 0, 0.35);
  m.add(orbit);
  const OR = 0.4;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const d = bit(orbit, CUBE, basic(CYAN, 0.35));
    d.position.set(Math.cos(a) * OR, 0, Math.sin(a) * OR);
    d.rotation.y = -a;
    d.scale.set(0.006, 0.006, 0.05);
  }
  const tokens = [0, 1, 2].map((i) => {
    const g = new THREE.Group();
    orbit.add(g);
    // A coin standing on edge facing outward: a deep rim, a pale face, a bright glint.
    const face = new THREE.Group();
    g.add(face);
    const rim = bit(face, coin, basic(CYAN));
    const inner = bit(face, coin, basic(PALE));
    const mark = bit(face, CUBE, basic(DEEP));
    if (vox) {
      rim.scale.set(0.075, 0.075, 0.02);
      inner.scale.set(0.05, 0.05, 0.026);
      mark.scale.set(0.034, 0.012, 0.03);
    } else {
      rim.rotation.x = inner.rotation.x = Math.PI / 2;
      rim.scale.set(0.085, 0.022, 0.085);
      inner.scale.set(0.062, 0.026, 0.062);
      mark.scale.set(0.04, 0.012, 0.03);
      mark.position.z = 0.014;
    }
    const trail = [1, 2, 3].map((j) => {
      const tr = bit(orbit, CUBE, basic(GLOW, 0.5 - j * 0.12));
      tr.scale.setScalar(0.03 - j * 0.006);
      return tr;
    });
    return { g, face, trail, p: i / 3 };
  });

  // Stars further out.
  const stars = Array.from({ length: 12 }, () => {
    const o = bit(m, CUBE, basic(rnd() < 0.5 ? PALE : GLOW));
    const a = rnd() * Math.PI * 2;
    const r = 0.5 + rnd() * 0.18;
    o.position.set(Math.cos(a) * r, (rnd() - 0.5) * 1.0, Math.sin(a) * r);
    return { o, w: rnd() * 6, s: 0.7 + rnd() * 0.8 };
  });

  const place = (a: number, at: THREE.Object3D) => at.position.set(Math.cos(a) * OR, 0, Math.sin(a) * OR);
  tick((t, walking) => {
    const w = walking ? 1.5 : 1;
    spin.rotation.y = -t * 0.35 * w;
    wheel.rotation.y = t * 0.6 * w;
    sigil.position.y = Math.sin(t * 0.9) * 0.012;
    // The orbit holds still in its plane; only the tokens go round it (one lap in about ten seconds).
    for (const k of tokens) {
      const a = t * 0.62 * w + k.p * Math.PI * 2;
      place(a, k.g);
      // Far-side tokens (z < 0 in the orbit's frame) are smaller; the near ones swell a little.
      const near = (Math.sin(a) + 1) / 2;
      const size = 0.78 + near * 0.4;
      k.g.scale.setScalar(size);
      k.face.rotation.y = -a + Math.PI / 2 + Math.sin(t * 1.6 + k.p * 9) * 0.5;
      k.trail.forEach((tr, j) => place(a - (j + 1) * 0.16, tr));
    }
    for (const s of stars) {
      const tw = smooth(0.55, 1, Math.sin(t * s.s * 1.8 + s.w) * 0.5 + 0.5);
      s.o.scale.setScalar(0.003 + tw * 0.022);
      s.o.rotation.set(t, t * 0.8, 0);
    }
  });
};
