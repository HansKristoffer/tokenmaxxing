/**
 * The Julemarked case's hats, glasses and held things in 3D (`core/src/case-julemarked.ts`: four hats, three glasses,
 * five things held). Loaded by `gear3d.ts`, it adds its builders to the shop's `HAT_BUILDERS` / `FACE_BUILDERS` /
 * `HELD_BUILDERS` by item name and pulls in the body half (`gear3dJulemarkedBody.ts`: outfits and back items). Frames are
 * those of `gear3dHead.ts` (origin at the skull's centre, +z the face, +y up) and `gear3dBody.ts` (held: origin at the
 * hand, +z away from the body). Wool, paper and candlelight: matte reds, no gloss. Brief: `docs/cases/julemarked.md`.
 */
import type * as THREE from "three";
import type { Model } from "../kit/kit.ts";
import "./gear3dJulemarkedBody.ts";
import { HELD_BUILDERS, type HeldBuilder } from "./gear3dBody.ts";
import {
  COVERS_HAIR,
  dome,
  EYE_Y,
  eyeAt,
  FACE_BUILDERS,
  HAT_BUILDERS,
  lit,
  ring,
  sign,
} from "./gear3dHead.ts";
import { isVox, squarePane } from "./voxgear.ts";

const RED = "#b8302c";
const RED_DARK = "#8f2421";
const CREAM = "#f4ecd8";
const CREAM_DARK = "#d9cdb0";
const GREEN = "#2f5d3a";
const GREEN_LIGHT = "#44794e";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const PEBER = "#6b3f22";
const FLAME = "#ffd56a";

/** A point at angle `a` round a head: on a circle for smooth models, on the square band for blocky ones. */
function roundAt(m: THREE.Object3D, a: number, r: number): [number, number] {
  const x = Math.sin(a);
  const z = Math.cos(a);
  if (!isVox(m)) return [x * r, z * r];
  const k = (r * 0.92) / Math.max(Math.abs(x), Math.abs(z));
  return [x * k, z * k];
}

// MARK: Hats

/** A tall red cone of shrinking cylinders that slumps to one side, a cream fold at the brim and a pompom at the tip. */
function nissehue(m: Model): void {
  if (isVox(m)) m.box([0.55, 0.3, 0.55], RED, [0, 0.0, 0], 0.01);
  m.cyl(0.285, 0.1, RED, [0, 0.05, 0], 0.27, 16);
  m.cyl(0.298, 0.075, CREAM, [0, 0.03, 0], 0.298, 18);
  const N = 6;
  let x = 0;
  let y = 0.14;
  let r = 0.255;
  for (let i = 0; i < N; i++) {
    const h = 0.085;
    const r2 = r * 0.8;
    const lean = 0.012 + i * i * 0.0055;
    m.cyl(r, h, i % 2 ? RED : "#c23a34", [x, y, -i * 0.006], r2, 14);
    x += lean;
    y += h * (1 - i * 0.075);
    r = r2;
  }
  m.ball(0.052, CREAM, [x + 0.01, y - 0.01, -N * 0.006], [1, 1, 1], 10);
}

/** A knitted beanie: cream crown with red bands of stitches, a ribbed brim, a big cream pompom. */
function pomponhue(m: Model): void {
  if (isVox(m)) {
    m.box([0.55, 0.3, 0.55], CREAM, [0, 0.0, 0], 0.01);
    m.box([0.56, 0.05, 0.56], RED, [0, 0.16, 0], 0.01);
  }
  dome(m, CREAM, 0.283, 0.03, 0.46);
  for (const [y, rr] of [
    [0.115, 0.275],
    [0.185, 0.235],
  ] as const)
    m.cyl(rr, 0.034, RED, [0, y, 0], rr - 0.013, 18);
  // The rib band: a ring of upright ribs.
  m.cyl(0.293, 0.095, CREAM_DARK, [0, 0.015, 0], 0.293, 18);
  const n = 18;
  for (let i = 0; i < n; i++) {
    const [x, z] = roundAt(m, (i / n) * Math.PI * 2, 0.3);
    m.box([0.034, 0.09, 0.034], i % 2 ? CREAM : "#e7dcc0", [x, 0.017, z], 0.01);
  }
  // The bobble, fluffed with a few tufts.
  m.ball(0.085, CREAM, [0, 0.35, -0.02], [1, 1, 1], 12);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    m.ball(0.032, i % 2 ? "#fffaf0" : CREAM, [Math.sin(a) * 0.065, 0.35 + Math.cos(a * 2) * 0.045, -0.02 + Math.cos(a) * 0.065], [1, 1, 1], 6);
  }
}

/** A ring of spruce: a torus on a smooth head, cones of needles round it. */
function wreath(m: Model, y: number, tone: string, light: string): void {
  ring(m, tone, 0.265, 0.04, [0, y, 0]);
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, z] = roundAt(m, a, 0.27);
    const c = m.cyl(0.032, 0.085, i % 2 ? tone : light, [x, y - 0.012, z], 0.003, 5);
    c.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
  }
}

/** A pine wreath with a red bow at one side and a few gold berries. */
function grankrans(m: Model): void {
  wreath(m, 0.12, GREEN, GREEN_LIGHT);
  for (let i = 0; i < 9; i++) {
    const a = 0.4 + i * 0.69;
    const [x, z] = roundAt(m, a, 0.29);
    m.ball(0.017, GOLD, [x, 0.145, z], [1, 1, 1], 6);
  }
  // The bow, at the front left of the crown.
  const [bx, bz] = roundAt(m, -0.75, 0.3);
  const bow = m.part([bx, 0.15, bz], -0.75);
  for (const s of [-1, 1]) {
    const loop = bow.box([0.075, 0.055, 0.02], RED, [s * 0.05, -0.03, 0.01], 0.01);
    loop.rotation.z = s * 0.3;
    const tail = bow.box([0.03, 0.1, 0.014], RED_DARK, [s * 0.035, -0.14, 0.005], 0.004);
    tail.rotation.z = s * 0.25;
  }
  bow.box([0.04, 0.04, 0.03], RED_DARK, [0, -0.032, 0.02], 0.008);
}

/** A leaf crown with four small candles, cartoon flames that flicker. */
function luciaKrone(m: Model, c: { tick(fn: (t: number) => void): void }): void {
  wreath(m, 0.1, GREEN, GREEN_LIGHT);
  const flames: THREE.Mesh[] = [];
  const angles = [-0.9, -0.3, 0.3, 0.9, Math.PI];
  for (const [i, a] of angles.entries()) {
    const [x, z] = roundAt(m, a, 0.265);
    m.cyl(0.021, 0.115, i === 4 ? CREAM_DARK : CREAM, [x, 0.1, z], 0.021, 8);
    m.box([0.004, 0.014, 0.004], "#3a2a1e", [x, 0.215, z], 0.001);
    flames.push(m.ball(0.022, lit(FLAME), [x, 0.245, z], [0.7, 1.35, 0.7], 6));
  }
  c.tick((t) =>
    flames.forEach((f, i) => {
      f.scale.set(0.7, 1.35 + Math.sin(t * 9 + i * 2.1) * 0.22, 0.7);
      f.rotation.z = Math.sin(t * 6 + i * 1.7) * 0.15;
    }),
  );
}

Object.assign(HAT_BUILDERS, {
  Nissehue: (m: Model) => nissehue(m),
  Pomponhue: (m: Model) => pomponhue(m),
  Grankrans: (m: Model) => grankrans(m),
  "Lucia-krone": (m: Model, c: { tick(fn: (t: number) => void): void }) => luciaKrone(m, c),
});
for (const n of ["Nissehue", "Pomponhue"]) COVERS_HAIR.add(n);

// MARK: Glasses

/** A round lens (a square pane on a blocky face) in a rim. */
function roundLens(e: Model, frame: string, glass: THREE.Material | string, r = 0.062): void {
  ring(e, frame, r, 0.008, [0, 0, 0], false);
  if (glass && isVox(e)) squarePane(e, r * 0.95, glass as THREE.Material, [0, 0, 0.002]);
}

/** Arms back round the head from the lens rims. */
function arms(m: Model, color: string, y = EYE_Y): void {
  const x = isVox(m) ? 0.2 : 0.255;
  for (const s of [-1, 1]) {
    const o = m.box([0.012, 0.012, 0.18], color, [s * x, y + 0.005, 0.1], 0.004);
    if (!isVox(m)) o.rotation.y = s * -0.12;
  }
}

Object.assign(FACE_BUILDERS, {
  // Two rosy stripes of cold cheek under the eyes, painted straight onto the face.
  "Kolde kinder": (m: Model) => {
    const z = isVox(m) ? 0.25 : 0.268;
    sign(
      m,
      0.4,
      0.09,
      (g, w, h) => {
        g.fillStyle = "#e0757a";
        for (const x0 of [0.08, 0.6]) {
          for (const k of [0, 1]) {
            g.fillRect((x0 + k * 0.05) * w, (0.08 + k * 0.5) * h, 0.3 * w, 0.34 * h);
          }
        }
      },
      [0, EYE_Y - 0.08, z],
      140,
    );
  },
  // Round frames made of a chain of tiny bulbs in red, gold and green; the two lenses blink out of time.
  "Julelys-briller": (m: Model, c: { tick(fn: (t: number) => void): void }) => {
    const cols = [RED, GOLD, GREEN_LIGHT];
    const bulbs: { b: THREE.Mesh; i: number; k: number }[] = [];
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      ring(e, "#2f5d3a", 0.07, 0.004, [0, 0, 0], false);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        bulbs.push({
          b: e.ball(0.016, lit(cols[i % 3]!), [Math.sin(a) * 0.07, Math.cos(a) * 0.07, 0.004], [1, 1, 1], 6),
          i,
          k: s > 0 ? 1 : 0,
        });
      }
    }
    m.box([0.05, 0.012, 0.012], "#2f5d3a", [0, EYE_Y + 0.012, 0.245], 0.004);
    arms(m, "#2f5d3a");
    c.tick((t) => {
      for (const { b, i, k } of bulbs) {
        const on = (Math.floor(t * 2.2) + i + k) % 2 === 0;
        b.scale.setScalar(on ? 1.05 : 0.5);
      }
    });
  },
  // Thin round gold specs with fluffy white tufts for brows.
  Nissebriller: (m: Model) => {
    for (const s of [-1, 1] as const) {
      const e = eyeAt(m, s);
      roundLens(e, GOLD, "#fff6d0", 0.06);
      for (const [dx, dy, r] of [
        [-0.03, 0.095, 0.026],
        [0.0, 0.11, 0.032],
        [0.032, 0.098, 0.026],
        [s * -0.05, 0.088, 0.02],
      ] as const)
        e.ball(r, "#fbf8f0", [dx, dy, 0.012], [1.25, 0.9, 1], 8);
    }
    m.box([0.05, 0.012, 0.012], GOLD, [0, EYE_Y + 0.012, 0.245], 0.004);
    arms(m, GOLD);
  },
});

// MARK: Held

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // Cream mug with a red band, dark wine gløgg, a raisin and an almond on top, steam.
  "Gløgg mug": (h, tick) => {
    h.cyl(0.04, 0.085, CREAM, [0, 0.0, 0.06], 0.045, 14);
    h.cyl(0.0425, 0.026, RED, [0, 0.026, 0.06], 0.0435, 14);
    ring(h, CREAM, 0.027, 0.008, [0.052, 0.042, 0.06], false);
    h.cyl(0.039, 0.004, "#4a1620", [0, 0.083, 0.06], 0.039, 12);
    h.ball(0.009, "#2a1418", [-0.012, 0.087, 0.066], [1, 0.7, 1], 6);
    h.ball(0.008, "#2a1418", [0.016, 0.087, 0.052], [1, 0.7, 1], 6);
    h.ball(0.012, "#e2c79a", [0.0, 0.089, 0.05], [1.4, 0.6, 0.9], 6);
    const puffs = [0, 1].map(() => h.ball(0.013, lit("#ffffff"), [0, 0.1, 0.06]));
    tick((t) =>
      puffs.forEach((p, i) => {
        const k = (t * 0.6 + i / 2) % 1;
        p.position.set(Math.sin(k * 8 + i * 3) * 0.01, 0.1 + k * 0.12, 0.06);
        p.scale.setScalar(Math.max(0.01, 1 - k * 0.7));
      }),
    );
  },
  // A paper cone with a red stripe, glazed brown almonds heaped at the top, a sugar sparkle.
  "Brændte mandler": (h, tick) => {
    const at = h.part([0, 0, 0.06]);
    at.cyl(0.012, 0.05, CREAM, [0, 0.0, 0], 0.03, 10);
    at.cyl(0.03, 0.04, RED, [0, 0.05, 0], 0.044, 10);
    at.cyl(0.044, 0.045, CREAM, [0, 0.09, 0], 0.056, 10);
    at.cyl(0.054, 0.01, CREAM_DARK, [0, 0.133, 0], 0.056, 10);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = i === 0 ? 0 : 0.026 + (i % 2) * 0.008;
      const al = at.ball(0.017, i % 3 ? "#7a4a26" : "#5d3418", [Math.sin(a) * r, 0.14 + (i % 3) * 0.008, Math.cos(a) * r], [0.8, 1.15, 0.8], 6);
      al.rotation.set(Math.sin(a), 0, Math.cos(a));
    }
    const sparks = [0, 1, 2].map((i) => at.ball(0.007, lit("#ffffff"), [(i - 1) * 0.03, 0.17, 0.0], [1, 1, 1], 4));
    tick((t) =>
      sparks.forEach((s, i) => {
        s.scale.setScalar(0.2 + Math.max(0, Math.sin(t * 3 + i * 2.2)) ** 3 * 1.2);
      }),
    );
  },
  // A round plate of five golden puffs dusted with sugar and a dollop of red jam, held flat.
  Æbleskiver: (h) => {
    const p = h.part([0, 0.0, 0.1]);
    p.cyl(0.115, 0.012, CREAM, [0, 0.0, 0], 0.115, 16);
    p.cyl(0.118, 0.008, RED, [0, 0.012, 0], 0.118, 16);
    p.cyl(0.098, 0.004, CREAM, [0, 0.019, 0], 0.098, 16);
    const spots: [number, number][] = [
      [0, 0],
      [0.055, 0.03],
      [-0.055, 0.03],
      [0.035, -0.055],
      [-0.035, -0.055],
    ];
    for (const [x, z] of spots) {
      p.ball(0.036, "#c98a3c", [x, 0.035, z], [1, 0.85, 1], 10);
      p.ball(0.024, "#fffaf0", [x, 0.062, z], [1, 0.4, 1], 8);
    }
    p.ball(0.014, RED, [0, 0.066, 0.0], [1, 0.7, 1], 6);
    p.ball(0.01, "#fffaf0", [-0.03, 0.058, 0.07], [1, 0.4, 1], 5);
  },
  // A round red tin with a white lid and a band of hearts, a few pepper nuts spilling.
  "Pebernød tin": (h) => {
    const t = h.part([0, 0, 0.06]);
    t.cyl(0.05, 0.075, RED, [0, 0, 0], 0.05, 16);
    t.cyl(0.054, 0.025, CREAM, [0, 0.075, 0], 0.054, 16);
    t.cyl(0.0505, 0.012, CREAM_DARK, [0, 0.0, 0], 0.0505, 16);
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785;
      const heart = i % 2 === 0;
      t.box(heart ? [0.016, 0.014, 0.006] : [0.012, 0.012, 0.006], heart ? CREAM : GOLD, [Math.sin(a) * 0.051, 0.038, Math.cos(a) * 0.051], 0.002).rotation.y = a;
    }
    for (const [x, y, z] of [
      [0.062, 0.006, 0.03],
      [0.075, 0.006, -0.008],
      [0.058, 0.006, -0.04],
      [0.05, 0.095, 0.02],
      [-0.02, 0.098, -0.02],
    ] as const)
      t.ball(0.0085, PEBER, [x, y + 0.008, z], [1, 0.9, 1], 5);
    t.ball(0.0085, "#8a5a32", [0.035, 0.108, 0.0], [1, 0.9, 1], 5);
  },
  // A half-unwrapped bun in a paper sleeve: pink roast pork, an amber crackling edge, a red-cabbage dot.
  Flæskestegssandwich: (h) => {
    const s = h.part([0, 0, 0.07]);
    s.rotation.x = -0.15;
    s.box([0.1, 0.04, 0.062], "#d9a35a", [0, 0.0, 0], 0.014);
    s.box([0.104, 0.02, 0.066], "#e8b96c", [0, 0.034, 0], 0.01);
    s.box([0.106, 0.02, 0.07], "#c98a3c", [0, 0.005, 0], 0.008);
    for (const [i, y] of [0.03, 0.04].entries()) {
      s.box([0.112, 0.012, 0.07], i ? "#e8a0a0" : "#f2b8b0", [0, y, 0.002], 0.004);
    }
    s.box([0.116, 0.016, 0.066], "#e09a2a", [0, 0.05, 0], 0.006);
    for (let i = 0; i < 5; i++) s.box([0.012, 0.012, 0.012], "#b8741a", [-0.045 + i * 0.022, 0.067, -0.004 + (i % 2) * 0.01], 0.003);
    s.box([0.1, 0.028, 0.058], "#e8b96c", [0, 0.066, 0], 0.012);
    s.ball(0.012, "#7a2a50", [0.042, 0.052, 0.036], [1, 0.8, 1], 6);
    // The paper sleeve around the lower half, torn at the top.
    s.box([0.108, 0.05, 0.072], CREAM, [0, -0.04, 0], 0.004);
    s.box([0.11, 0.008, 0.074], RED, [0, -0.0, 0], 0.002);
    s.box([0.04, 0.03, 0.074], CREAM, [-0.03, 0.012, 0], 0.003);
  },
};
Object.assign(HELD_BUILDERS, HELD);

void WOOD;
