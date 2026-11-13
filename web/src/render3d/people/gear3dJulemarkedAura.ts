/**
 * The Julemarked case's four legendary auras in 3D (`core/src/case-julemarked.ts`, slot "aura"): Julestjerne,
 * Adventskrans, Snefnug and Nordlys. Like the other cases' (`gear3dAura.ts`, `gear3dRagnarokAura.ts`) each builder
 * gets a frame at the middle of the body, scaled to the avatar's height (one unit is one metre of a 0.95 m person)
 * and registers a tick that moves its parts. Registered by `gear3dAura.ts`, which calls `registerJulemarkedAuras`
 * (this file never imports it back, so the two cannot form a cycle). Warm and woolly: paper, candlelight, snow;
 * the one green is the northern lights', and it stays pale.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded } from "../kit/kit.ts";
import type { AuraBuilder } from "./gear3dAura.ts";

const CUBE = new THREE.BoxGeometry(1, 1, 1);

/** Materials every wearer shares: one per colour (and opacity), never disposed with a model. */
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

/** A cube of `w`×`h`×`d` metres that moves and scales and stays out of the blocky swap. */
function cube(
  parent: THREE.Object3D,
  size: [number, number, number],
  mat: THREE.Material,
  at?: [number, number, number],
): THREE.Mesh {
  const o = new THREE.Mesh(CUBE, mat);
  o.scale.set(...size);
  o.userData.noBlock = true;
  if (at) o.position.set(...at);
  parent.add(o);
  return o;
}

/** A mesh of its own geometry (cached by the caller) that stays out of the blocky swap. */
function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.userData.noBlock = true;
  parent.add(o);
  return o;
}

// MARK: Julestjerne

/** A folded paper star: three stretched octahedra crossed on x, y and z, giving six spikes. */
const STAR = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (const axis of [0, 1, 2]) {
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(axis === 0 ? 1 : 0.3, axis === 1 ? 1 : 0.3, axis === 2 ? 1 : 0.3);
    parts.push(g);
  }
  const out = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return out;
})();
const STAR_COLORS = ["#c8102e", "#f4ecd8", "#f2c14e", "#b8302c", "#ffffff"];

// Julestjerne: seven paper stars drift round in a slow loose ring, each turning on its own, red and white and gold.
const julestjerne: AuraBuilder = (m, tick) => {
  const stars = Array.from({ length: 7 }, (_, i) => {
    const o = mesh(m, STAR, basic(STAR_COLORS[i % STAR_COLORS.length]!));
    o.scale.setScalar(0.085 + (i % 3) * 0.02);
    return o;
  });
  // A twinkle of gold dust between them.
  const rnd = seeded(800);
  const dust = Array.from({ length: 8 }, () => ({
    o: cube(m, [0.016, 0.016, 0.016], basic("#f2c14e")),
    a: rnd() * Math.PI * 2,
    p: rnd(),
    r: 0.34 + rnd() * 0.16,
  }));
  tick((t, walking) => {
    stars.forEach((s, i) => {
      const a = t * (walking ? 0.55 : 0.38) + (i / stars.length) * Math.PI * 2;
      const r = 0.42 + Math.sin(t * 0.7 + i * 2) * 0.04;
      s.position.set(
        Math.cos(a) * r,
        -0.22 + (i % 4) * 0.17 + Math.sin(t * 1.1 + i * 1.7) * 0.06,
        Math.sin(a) * r,
      );
      s.rotation.set(t * (0.8 + i * 0.1), t * (1.1 - i * 0.07), i);
    });
    for (const d of dust) {
      const k = (t * 0.3 + d.p) % 1;
      const a = d.a + t * 0.3;
      d.o.position.set(Math.cos(a) * d.r, -0.3 + k * 0.9, Math.sin(a) * d.r);
      d.o.scale.setScalar(Math.sin(k * Math.PI) * 0.02 + 0.001);
    }
  });
};

// MARK: Adventskrans

/** A wreath: small dark and mid green cubes round a ring, merged to one mesh. */
function wreath(r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rnd = seeded(801);
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = 0.03 + rnd() * 0.018;
    const g = new THREE.BoxGeometry(s * 1.6, s, s * 1.3).toNonIndexed();
    g.rotateX(rnd() * 1.2);
    g.rotateY(-a);
    g.translate(Math.sin(a) * r, (rnd() - 0.5) * 0.025, Math.cos(a) * r);
    const col = new THREE.Color(i % 3 === 0 ? "#3f7a4a" : "#2f5d3a");
    const colors = new Float32Array(g.attributes.position!.count * 3);
    for (let k = 0; k < colors.length; k += 3) colors.set([col.r, col.g, col.b], k);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  }
  const out = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return out;
}
const WREATH = wreath(0.4);
const WREATH_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
WREATH_MAT.userData.shared = true;

// Adventskrans: a ring of green with four candles in it, burning, going slowly round with a red ribbon bow.
const adventskrans: AuraBuilder = (m, tick) => {
  const ring = new THREE.Group();
  ring.position.y = -0.18;
  m.add(ring);
  mesh(ring, WREATH, WREATH_MAT);
  const candles = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
    g.scale.setScalar(1.5);
    ring.add(g);
    // A candle with a red stripe, a wick, a flame and a faint halo.
    cube(g, [0.04, 0.12, 0.04], basic(i % 2 ? "#f4ecd8" : "#c8102e"), [0, 0.07, 0]);
    cube(g, [0.044, 0.02, 0.044], basic("#f4ecd8"), [0, 0.1, 0]);
    cube(g, [0.006, 0.014, 0.006], basic("#3a2a1c"), [0, 0.14, 0]);
    const flame = new THREE.Group();
    flame.position.y = 0.17;
    g.add(flame);
    cube(flame, [0.028, 0.05, 0.028], basic("#f2c14e"));
    cube(flame, [0.014, 0.03, 0.014], basic("#fff2c0"), [0, -0.005, 0]);
    return { g, flame };
  });
  // The red ribbon bow at the front of the wreath.
  const bow = new THREE.Group();
  bow.position.set(0, 0, 0.4);
  ring.add(bow);
  cube(bow, [0.04, 0.04, 0.03], basic("#b8302c"));
  cube(bow, [0.05, 0.035, 0.02], basic("#b8302c"), [-0.045, 0.01, 0]).rotation.z = 0.3;
  cube(bow, [0.05, 0.035, 0.02], basic("#b8302c"), [0.045, 0.01, 0]).rotation.z = -0.3;
  // Sparks off the flames.
  const rnd = seeded(802);
  const sparks = Array.from({ length: 6 }, (_, i) => ({
    o: cube(m, [0.014, 0.014, 0.014], basic("#ffd36a")),
    c: i % 4,
    p: rnd(),
  }));
  tick((t, walking) => {
    ring.rotation.y = t * (walking ? 0.5 : 0.3);
    ring.position.y = -0.18 + Math.sin(t * 1.2) * 0.02;
    candles.forEach(({ flame }, i) => {
      const f = 1 + Math.sin(t * 11 + i * 2.3) * 0.12 + Math.sin(t * 17 + i) * 0.08;
      flame.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
      flame.rotation.z = Math.sin(t * 7 + i) * 0.1;
    });
    for (const s of sparks) {
      const k = (t * 0.5 + s.p) % 1;
      const a = (s.c / 4) * Math.PI * 2 + ring.rotation.y;
      s.o.position.set(Math.sin(a) * 0.4, -0.01 + k * 0.4, Math.cos(a) * 0.4);
      s.o.scale.setScalar(Math.sin(k * Math.PI) * 0.016 + 0.001);
    }
  });
};

// MARK: Snefnug

/** A six-armed flake: three thin flat bars crossed, merged to one mesh. */
const FLAKE = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BoxGeometry(1, 0.12, 0.12).toNonIndexed();
    g.rotateY((i / 3) * Math.PI);
    parts.push(g);
  }
  const out = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return out;
})();

// Snefnug: fresh snow swirls down round the wearer in a loose spiral, soft flakes and a few six-armed crystals that never land.
const snefnug: AuraBuilder = (m, tick) => {
  const rnd = seeded(803);
  const flakes = Array.from({ length: 40 }, (_, i) => {
    const crystal = i % 6 === 0;
    const o = crystal
      ? mesh(m, FLAKE, basic(i % 12 === 0 ? "#bcd8e8" : "#ffffff"))
      : cube(m, [0.02, 0.02, 0.02], basic(i % 3 ? "#ffffff" : "#e6f1f8"));
    return {
      o,
      crystal,
      p: rnd(),
      a: rnd() * Math.PI * 2,
      r: 0.3 + rnd() * 0.2,
      s: 0.7 + rnd() * 0.6,
      w: (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5),
    };
  });
  tick((t, walking) => {
    for (const f of flakes) {
      // Fall from above the head to the knees, then fade out before starting again; the swirl widens near the top.
      const k = (t * 0.16 * f.s + f.p) % 1;
      const a = f.a + t * f.w * (walking ? 0.9 : 0.6) + k * 2.4;
      const r = f.r + Math.sin(k * Math.PI) * 0.04;
      f.o.position.set(Math.cos(a) * r, 0.62 - k * 1.1 + Math.sin(t * 2 + f.a) * 0.015, Math.sin(a) * r);
      const sz = Math.sin(k * Math.PI) ** 0.5;
      f.o.scale.setScalar(f.crystal ? 0.05 * sz + 0.001 : 0.02 * sz + 0.001);
      if (f.crystal) f.o.rotation.set(t * 0.5 + f.a, t * 0.9, f.a);
    }
  });
};

// MARK: Nordlys

const NORDLYS = ["#b9f2d4", "#a6ecd2", "#cfe9d8"];

// Nordlys: three pale ribbons of northern lights wave round the wearer at different heights and speeds, each a curtain
// of soft strips that rise and fall, with a few stars. Pale and see-through; the green stays soft.
const nordlys: AuraBuilder = (m, tick) => {
  const SEG = 20;
  const ribbons = NORDLYS.map((c, ri) => {
    const strips = Array.from({ length: SEG }, (_, i) => {
      const o = cube(m, [0.05, 0.2, 0.012], basic(c, 0.4));
      // The head of the curtain is brighter: a thin line along its lower edge.
      const edge = cube(o, [1, 0.12, 1], basic("#ecfff6", 0.55), [0, -0.44, 0]);
      edge.scale.set(1, 0.12, 1);
      return { o, k: i / SEG };
    });
    return { strips, ri };
  });
  const rnd = seeded(804);
  const twinkles = Array.from({ length: 6 }, () => ({
    o: cube(m, [0.016, 0.016, 0.016], basic("#ffffff")),
    a: rnd() * Math.PI * 2,
    y: rnd() * 0.9 - 0.3,
    p: rnd() * 6,
  }));
  tick((t, walking) => {
    for (const { strips, ri } of ribbons) {
      const sweep = Math.PI * (0.8 + ri * 0.12);
      const base = t * (walking ? 0.5 : 0.3) * (ri % 2 ? -1 : 1) + ri * 2.1;
      for (const s of strips) {
        const a = base + (s.k - 0.5) * sweep;
        const r = 0.4 + ri * 0.035 + Math.sin(t * 0.9 + s.k * 7 + ri) * 0.025;
        const wave = Math.sin(t * 1.3 + s.k * 6 + ri * 1.7);
        s.o.position.set(Math.sin(a) * r, 0.18 - ri * 0.12 + wave * 0.11 + Math.sin(t * 0.8 + s.k * 11 + ri * 3) * 0.04, Math.cos(a) * r);
        s.o.rotation.y = a;
        const fade = Math.sin(s.k * Math.PI) ** 0.7;
        s.o.scale.set(sweep * r * 1.1 / SEG, (0.12 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.k * 9 + ri))) * fade + 0.004, 0.012);
      }
    }
    for (const w of twinkles) {
      w.o.position.set(Math.cos(w.a + t * 0.2) * 0.45, w.y, Math.sin(w.a + t * 0.2) * 0.45);
      w.o.scale.setScalar((0.5 + 0.5 * Math.sin(t * 3 + w.p)) * 0.016 + 0.001);
    }
  });
};

/** Adds the four auras to `into` (the builders table of `gear3dAura.ts`), keyed by the item's name. */
export function registerJulemarkedAuras(into: Record<string, AuraBuilder>): void {
  into.Julestjerne = julestjerne;
  into.Adventskrans = adventskrans;
  into.Snefnug = snefnug;
  into.Nordlys = nordlys;
}
