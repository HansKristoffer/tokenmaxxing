/**
 * The Night Market case in 3D (`core/src/case.ts`): its six outfits, four things held and three things worn on the
 * back, in the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3d.ts`, it adds its builders
 * to the shop's tables: outfits under their look index (`CASE_BASE + n`), held and back items under their names.
 * Outfit colours are in `data/gear.ts`, the 2D art in `art/case-body.ts`.
 */
import { CASE_BASE } from "@tokenmaxxing/core/case.ts";
import * as THREE from "three";
import { seeded } from "../kit/kit.ts";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  HELD_BUILDERS,
  type HeldBuilder,
  hood,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
  sleeveStripes,
  tails,
} from "./gear3dBody.ts";
import { lit, see } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const GOLD = "#f2c230";
const CREAM = "#f4efe4";
const RED = "#d83a2e";
const CYAN = "#3ff0ff";
const PINK = "#ff3fb0";
const INK = "#2b2433";

/**
 * A paper lantern on a string, hanging from `at` (cubes) in `parent`: a glowing body with darker ribs, caps and a tassel.
 * The returned pivot is the string's top, so tilting it swings the lantern.
 */
function lantern(parent: VoxModel, at: [number, number, number], w: number, body: string, rib: string): VoxModel {
  const pivot = vpart(parent, [at[0] * U, at[1] * U, at[2] * U]);
  const v = new Vx(pivot);
  const h = w * 1.15;
  const top = -1.7;
  v.b(-0.1, top, -0.1, 0.2, -top, 0.2, INK);
  v.b(-w * 0.35, top - 0.1, -w * 0.35, w * 0.7, 0.4, w * 0.7, INK);
  v.b(-w / 2, top - 0.1 - h, -w / 2, w, h, w, lit(body));
  for (const f of [0.28, 0.62]) v.b(-w / 2 - 0.08, top - 0.1 - h * f - 0.12, -w / 2 - 0.08, w + 0.16, 0.24, w + 0.16, rib);
  v.b(-w * 0.35, top - 0.5 - h, -w * 0.35, w * 0.7, 0.4, w * 0.7, INK);
  v.b(-0.1, top - 1.7 - h, -0.1, 0.2, 1.3, 0.2, GOLD);
  return pivot;
}

/** Hangs `l` swinging; walking swings it harder. */
function swing(c: { tick: BodyCtx["tick"] }, l: VoxModel, phase = 0, axis: "x" | "z" = "z"): void {
  c.tick((t, walking) => {
    l.rotation[axis] = Math.sin(t * (walking ? 7 : 2) + phase) * (walking ? 0.2 : 0.07);
  });
}

// MARK: Outfits

const flare = (c: BodyCtx, color: string, trim: string) =>
  c.arms.forEach((arm) => {
    const v = new Vx(vpart(arm));
    v.b(-1.7, -6.2, -1.6, 3.4, 3.2, 3.2, color);
    v.b(-1.75, -6.3, -1.65, 3.5, 0.45, 3.3, trim);
  });

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Noodle apron: a white bib with a ramen bowl over a charcoal tee, straps over the shoulders, a bow at the back.
  0: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 15, 0, 27, 12);
        px(g, CREAM, 6, 12, 45, h - 12);
        px(g, "#d9d2c0", 9, 33, 39, 2);
        px(g, "#cfc8b5", 14, 36, 12, 6);
        px(g, "#cfc8b5", 31, 36, 12, 6);
        // The bowl: noodles, a red rim, a blue body.
        px(g, "#f2c94c", 21, 10, 15, 4);
        px(g, "#f2c94c", 24, 14, 9, 2);
        px(g, RED, 18, 17, 21, 3);
        px(g, "#3a6fb8", 20, 20, 17, 6);
        px(g, "#3a6fb8", 23, 26, 11, 2);
        // Splashes.
        for (const [x, y] of [[10, 5], [44, 9], [12, 28], [43, 31], [36, 3]] as const) px(g, "#e8793a", x, y, 3, 3);
      },
      (g, w) => {
        px(g, CREAM, 3, 22, w - 6, 3);
        px(g, CREAM, 18, 2, 3, 10);
        px(g, CREAM, 36, 2, 3, 10);
      },
    );
    const v = grid(c);
    v.b(-2.5, 0, 2, 5, 2.4, 0.3, CREAM);
    v.b(-2.9, -2.6, 1.9, 5.8, 2.6, 0.45, CREAM);
    v.b(-2.9, -2.6, 2.3, 5.8, 0.35, 0.1, "#d9d2c0");
    v.b(-1.6, -1.9, 2.3, 3.2, 1.1, 0.25, "#d9d2c0");
    for (const x of [-2.3, 1.7]) v.b(x, 8, -2, 0.6, 0.3, 4, CREAM);
    v.b(-3.7, 1.2, -2.25, 7.4, 0.7, 0.25, CREAM);
    v.b(-1.3, 0.5, -2.65, 1, 1.6, 0.35, CREAM);
    v.b(0.3, 0.5, -2.65, 1, 1.6, 0.35, CREAM);
    v.b(-0.3, 1.0, -2.65, 0.6, 0.6, 0.35, "#d9d2c0");
  },
  // Happi coat: indigo, white lapels, a rope belt with a gold knot, wide cuffs and a ring crest on the back.
  1: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 21, 0, 5, h);
        px(g, CREAM, 31, 0, 5, h);
      },
      (g, w, h) => {
        g.fillStyle = CREAM;
        g.beginPath();
        g.arc(28, 19, 14, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#2f4a8a";
        g.beginPath();
        g.arc(28, 19, 10, 0, Math.PI * 2);
        g.fill();
        px(g, RED, 21, 17, 15, 4);
        px(g, RED, 26, 11, 5, 16);
        px(g, CREAM, 0, h - 3, w, 3);
      },
    );
    roll(c, CREAM, 1.1, 0.4);
    roll(c, RED, 0.9, 0.3, 1.3);
    flare(c, "#2f4a8a", CREAM);
    const v = grid(c);
    v.b(-0.9, 1.1, 2.3, 1.8, 1.3, 0.5, GOLD);
    v.b(-0.8, -1.2, 2.3, 0.5, 2.4, 0.3, RED);
    v.b(0.3, -1.0, 2.3, 0.5, 2.2, 0.3, RED);
    v.b(-3.9, -1.8, -2.2, 7.8, 1.8, 4.4, "#2f4a8a");
    v.b(-3.95, -1.8, -2.25, 7.9, 0.35, 4.5, CREAM);
  },
  // Cargo bomber: olive, an orange lining at the collar, ribbed hem and cuffs, flap pockets, an orange sleeve strip.
  2: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, "#c9c2a6", 27, 0, 3, h);
        for (const x of [8, 40]) {
          px(g, "#4d5a2a", x, 20, 12, 9);
          px(g, "#6b7a3f", x + 1, 21, 10, 3);
        }
        px(g, "#f08a3c", 40, 6, 8, 6);
      },
      (g, w) => {
        px(g, "#f08a3c", 14, 8, w - 28, 12);
        px(g, "#4d5a2a", 18, 11, w - 36, 6);
      },
    );
    roll(c, "#39421f", 1.3, 0.45);
    roll(c, "#f08a3c", 0.4, 0.46, 7.2);
    roll(c, "#39421f", 1.3, 0.35, 0);
    const v = grid(c);
    for (const s of [-1, 1]) v.b(s > 0 ? 1.0 : -3.2, 1.4, 2.0, 2.2, 1.6, 0.45, "#4d5a2a");
    c.arms.forEach((arm, i) => {
      const a = new Vx(vpart(arm));
      a.b(-1.22, -6.4, -1.22, 2.44, 1.2, 2.44, "#39421f");
      a.b(i ? 0.95 : -1.3, -3.7, -0.5, 0.35, 2.4, 1, "#f08a3c");
    });
  },
  // Techwear coat: long and black with a funnel hood, neon cyan zip and buckles, a reflective stripe on the back.
  3: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CYAN, 27, 0, 3, h);
        for (const y of [12, 26]) {
          px(g, "#4a4d5c", 6, y, 45, 4);
          px(g, PINK, 11, y, 6, 4);
          px(g, PINK, 40, y, 6, 4);
        }
      },
      (g, w, h) => {
        px(g, CYAN, 3, 10, w - 6, 3);
        px(g, CYAN, 27, 0, 3, h);
        px(g, CYAN, 3, 28, w - 6, 2);
      },
      true,
    );
    hood(c, "#15161c", "#08080b");
    sleeveStripes(c, CYAN);
    tails(c, "#23252f", 4.4, CYAN);
    const v = grid(c);
    v.b(-3.7, -3.4, 1.6, 3.5, 3.4, 0.6, "#23252f");
    v.b(0.2, -3.4, 1.6, 3.5, 3.4, 0.6, "#23252f");
    v.b(-3.75, -3.4, 2.1, 3.6, 0.3, 0.15, CYAN);
    v.b(0.15, -3.4, 2.1, 3.6, 0.3, 0.15, CYAN);
    c.arms.forEach((arm) => new Vx(vpart(arm)).b(-1.2, -6.6, -1.2, 2.4, 1, 2.4, "#15161c"));
  },
  // Dragon satin jacket: teal-black satin with gold rib, a zip, a dragon on the left chest and a big one coiled up the back.
  4: (c) => {
    const dragon = (g: CanvasRenderingContext2D, pts: [number, number][], r: number) => {
      const path: [number, number][] = [];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        for (let k = 0; k < 6; k++) path.push([x0 + ((x1 - x0) * k) / 6, y0 + ((y1 - y0) * k) / 6]);
      }
      for (const [x, y] of path) px(g, "#b8860b", x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2);
      for (const [x, y] of path) px(g, GOLD, x - r, y - r, 2 * r, 2 * r);
    };
    marks(
      c,
      (g) => {
        dragon(g, [[8, 8], [14, 12], [10, 18], [16, 24]], 2);
        px(g, RED, 6, 6, 3, 3);
        px(g, GOLD, 27, 0, 2, 42);
      },
      (g) => {
        dragon(g, [[32, 9], [40, 12], [36, 19], [24, 22], [18, 28], [28, 33], [38, 36]], 3);
        px(g, GOLD, 26, 0, 12, 7);
        px(g, "#b8860b", 26, 0, 3, 3);
        px(g, RED, 33, 2, 2, 2);
        px(g, GOLD, 22, 5, 5, 2);
        px(g, GOLD, 36, 33, 6, 3);
      },
      true,
    );
    roll(c, GOLD, 1, 0.35);
    roll(c, GOLD, 1, 0.35, 0);
    sleeveStripes(c, "#2a6a78");
    c.arms.forEach((arm) => new Vx(vpart(arm)).b(-1.22, -6.4, -1.22, 2.44, 1, 2.44, GOLD));
  },
  // Festival parade: a red happi with a gold sash and a fan crest, and a carrying pole with lanterns that swing and glow.
  5: (c) => {
    marks(
      c,
      (g, _w, h) => {
        px(g, CREAM, 21, 0, 5, 20);
        px(g, CREAM, 31, 0, 5, 20);
        for (let i = 0; i < 38; i++) {
          px(g, "#b8860b", 4 + i * 1.2, i - 1, 9, 5);
          px(g, GOLD, 5 + i * 1.2, i, 7, 3);
        }
        px(g, GOLD, 0, h - 3, 57, 3);
      },
      (g, w) => {
        g.fillStyle = GOLD;
        for (let a = 0; a < 7; a++) {
          const t = Math.PI * (0.1 + (a * 0.8) / 6);
          g.beginPath();
          g.moveTo(28, 36);
          g.lineTo(28 + Math.cos(t + Math.PI) * 24, 36 - Math.sin(t) * 28);
          g.lineTo(28 + Math.cos(t + Math.PI + 0.12) * 24, 36 - Math.sin(t + 0.12) * 28);
          g.fill();
        }
        g.fillStyle = RED;
        g.beginPath();
        g.arc(28, 36, 7, 0, Math.PI * 2);
        g.fill();
        px(g, CREAM, 0, 0, w, 3);
      },
      true,
    );
    roll(c, CREAM, 1.1, 0.4);
    roll(c, GOLD, 1.3, 0.35, 1.2);
    flare(c, "#d6343a", GOLD);
    const v = grid(c);
    v.b(-1.1, 1.0, 2.3, 2.2, 1.6, 0.5, "#fbf7ef");
    v.b(-0.7, -1.4, 2.3, 0.5, 2.6, 0.3, GOLD);
    v.b(0.2, -1.2, 2.3, 0.5, 2.4, 0.3, GOLD);
    v.b(-3.9, -1.8, -2.2, 7.8, 1.8, 4.4, "#d6343a");
    v.b(-3.95, -1.8, -2.25, 7.9, 0.35, 4.5, GOLD);
    // The pole across the shoulders, and a big lantern with a small one below it at each end.
    v.b(-8.7, 7.0, -0.55, 17.4, 0.6, 1.1, "#7a5a34");
    for (const x of [-8.7, 8.1]) v.b(x, 6.9, -0.65, 0.6, 0.8, 1.3, GOLD);
    for (const [s, phase] of [[-1, 0], [1, 1.9]] as const) {
      const big = lantern(c.body, [s * 7.6, 7.0, 0], 2.8, "#ff5a3c", "#8a1f18");
      const small = lantern(big, [0, -8.2, 0], 1.7, "#ffb347", "#8a1f18");
      c.tick((t, walking) => {
        const a = Math.sin(t * (walking ? 6 : 1.8) + phase) * (walking ? 0.22 : 0.08);
        big.rotation.z = a;
        small.rotation.z = a * 0.8 + Math.sin(t * 3.1 + phase) * 0.05;
      });
    }
    // Confetti drifting down.
    const rnd = seeded(205);
    const colours = [GOLD, PINK, CYAN, RED, "#ffffff"];
    const bits = Array.from({ length: 8 }, (_, i) => ({
      m: v.b(0, 0, 0, 0.4, 0.4, 0.4, lit(colours[i % colours.length]!)),
      a: rnd() * Math.PI * 2,
      r: 6.5 + rnd() * 2.5,
      p: rnd(),
    }));
    const drift = (t: number) =>
      bits.forEach((b) => {
        const k = (t * 0.22 + b.p) % 1;
        b.m.position.set(Math.cos(b.a + t * 0.4) * b.r * U, (13 - k * 20) * U, Math.sin(b.a + t * 0.4) * b.r * U);
        b.m.rotation.y = t * 2 + b.a;
      });
    drift(0);
    c.tick(drift);
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[CASE_BASE + Number(n)] = build;

// MARK: Held

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // Ramen bowl: blue bowl, red rim, broth and noodles with an egg, a fish cake, nori and spring onion; steam, chopsticks.
  "Ramen bowl": (h, tick) => {
    h.cyl(0.04, 0.07, "#3a6fb8", [0, 0, 0.07], 0.07, 14);
    h.cyl(0.0705, 0.014, RED, [0, 0.056, 0.07], 0.0705, 14);
    h.cyl(0.064, 0.006, "#c9741f", [0, 0.066, 0.07], 0.064, 14);
    h.box([0.075, 0.016, 0.075], "#f2c94c", [0, 0.07, 0.07], 0.006);
    h.ball(0.02, CREAM, [-0.03, 0.09, 0.09], [1, 0.6, 1], 8);
    h.ball(0.01, "#f2a81d", [-0.03, 0.097, 0.09], [1, 0.7, 1], 6);
    h.cyl(0.02, 0.008, CREAM, [0.032, 0.082, 0.095], 0.02, 10);
    h.cyl(0.009, 0.01, "#f28bb2", [0.032, 0.09, 0.095], 0.009, 8);
    h.box([0.045, 0.055, 0.004], "#1d3a2a", [0.04, 0.075, 0.045], 0.001);
    for (const [x, z] of [[0.005, 0.055], [0.02, 0.105], [-0.012, 0.1]] as const) h.box([0.012, 0.01, 0.012], "#4caf50", [x, 0.085, z], 0.003);
    const sticks = h.part([0.03, 0.075, 0.07]);
    sticks.rotation.z = -0.65;
    for (const x of [-0.008, 0.008]) sticks.box([0.007, 0.2, 0.007], "#a8743a", [x, 0, 0], 0.002);
    const puffs = [0, 1, 2].map(() => h.ball(0.014, see("#ffffff", 0.6, true), [0, 0.1, 0.07]));
    tick((t) =>
      puffs.forEach((p, i) => {
        const k = (t * 0.7 + i / 3) % 1;
        p.position.set(Math.sin(k * 9 + i) * 0.015, 0.11 + k * 0.13, 0.07);
        p.scale.setScalar(1 - k * 0.6);
      }),
    );
  },
  // Paper umbrella: a red and white wagasa on a bamboo shaft, leaning, slowly turning.
  "Paper umbrella": (h, tick) => {
    const u = h.part([0, 0, 0.05]);
    u.rotation.z = -0.22;
    u.rotation.x = 0.05;
    u.scale.setScalar(0.62);
    u.cyl(0.014, 0.62, "#a8743a", [0, -0.14, 0], 0.014, 6);
    const canopy = u.part([0, 0.34, 0]);
    const rings: [number, string][] = [[0.27, CREAM], [0.245, RED], [0.2, CREAM], [0.15, RED], [0.095, CREAM], [0.045, RED]];
    rings.forEach(([r, col], i) => canopy.cyl(r, 0.03, col, [0, i * 0.026, 0], r, 14));
    canopy.cyl(0.012, 0.05, "#a8743a", [0, 0.15, 0], 0.012, 6);
    for (const turn of [0, Math.PI / 4]) {
      const ribs = canopy.part([0, -0.012, 0], turn);
      ribs.box([0.54, 0.008, 0.012], "#c9a36a", [0, 0, 0], 0.002);
      ribs.box([0.012, 0.008, 0.54], "#c9a36a", [0, 0, 0], 0.002);
    }
    for (const a of [0, 1, 2, 3]) canopy.ball(0.012, GOLD, [Math.cos(a * 1.57) * 0.26, -0.03, Math.sin(a * 1.57) * 0.26], [1, 1.4, 1], 5);
    tick((t) => {
      canopy.rotation.y = t * 0.9;
    });
  },
  // Boombox: a silver handle, two speakers that thump, a cassette window and a neon equaliser.
  Boombox: (h, tick) => {
    const b = h.part([0, 0, 0.07]);
    for (const s of [-1, 1]) b.box([0.012, 0.035, 0.012], "#aab3bf", [s * 0.055, -0.035, 0], 0.003);
    b.box([0.122, 0.012, 0.012], "#aab3bf", [0, -0.003, 0], 0.003);
    b.box([0.22, 0.13, 0.075], INK, [0, -0.17, 0], 0.01);
    b.box([0.222, 0.012, 0.077], "#aab3bf", [0, -0.052, 0], 0.003);
    b.box([0.222, 0.008, 0.005], lit(CYAN), [0, -0.172, 0.0385], 0.001);
    const cones: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      b.box([0.075, 0.075, 0.01], "#6a6f7c", [s * 0.068, -0.154, 0.04], 0.004);
      cones.push(b.box([0.052, 0.052, 0.012], "#14121a", [s * 0.068, -0.143, 0.044], 0.004));
      b.box([0.016, 0.016, 0.012], "#aab3bf", [s * 0.068, -0.126, 0.049], 0.003);
    }
    b.box([0.052, 0.03, 0.006], "#3a3546", [0, -0.106, 0.04], 0.002);
    b.box([0.04, 0.012, 0.007], lit(PINK), [0, -0.097, 0.041], 0.001);
    const bars = [0, 1, 2, 3].map((i) => b.box([0.008, 0.02, 0.006], lit(i % 2 ? CYAN : PINK), [-0.015 + i * 0.01, -0.132, 0.041], 0.001));
    const ant = b.part([0.095, -0.04, -0.02]);
    ant.rotation.z = -0.35;
    ant.box([0.006, 0.17, 0.006], "#aab3bf", [0, 0, 0], 0.001);
    ant.ball(0.008, PINK, [0, 0.175, 0], [1, 1, 1], 5);
    tick((t) => {
      const beat = Math.pow(Math.max(0, Math.sin(t * 9)), 3);
      for (const c of cones) c.scale.set(1 + beat * 0.14, 1 + beat * 0.14, 1 + beat * 0.5);
      bars.forEach((m, i) => m.scale.set(1, 0.4 + Math.abs(Math.sin(t * 8 + i * 1.9)) * 1.6, 1));
    });
  },
  // Skateboard: stood on its tail, pink deck to the front with a neon stripe, trucks and yellow wheels.
  Skateboard: (h) => {
    const s = h.part([0, 0, 0.06]);
    s.rotation.z = 0.16;
    s.rotation.x = -0.08;
    s.box([0.078, 0.36, 0.014], "#ff4fa3", [0, -0.18, 0], 0.01);
    s.box([0.012, 0.3, 0.004], lit(CYAN), [0.012, -0.15, 0.0075], 0.001);
    s.box([0.03, 0.03, 0.004], GOLD, [-0.016, -0.06, 0.0075], 0.001);
    s.box([0.03, 0.03, 0.004], "#ffffff", [-0.016, 0.0, 0.0075], 0.001);
    for (const y of [-0.12, 0.12]) {
      s.box([0.062, 0.016, 0.022], "#aab3bf", [0, y - 0.008, 0.018], 0.002);
      for (const x of [-0.038, 0.038]) s.box([0.018, 0.03, 0.03], GOLD, [x, y - 0.015, 0.032], 0.004);
    }
  },
};
Object.assign(HELD_BUILDERS, HELD);

// MARK: Back

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Neon drone: a four-rotor drone hovering beside the head, a pink eye and a cyan underglow.
  "Neon drone": (b, tick) => {
    const drone = vpart(b, [6.4 * U, 3.0 * U, -1 * U]);
    const v = new Vx(drone);
    v.b(-1.6, 0, -1.6, 3.2, 1.1, 3.2, "#2b2f3a");
    v.b(-1.1, 1.1, -1.1, 2.2, 0.5, 2.2, "#454a5c");
    v.b(-1.2, -0.3, -1.2, 2.4, 0.3, 2.4, lit(CYAN));
    v.b(-3.3, 0.4, -0.3, 6.6, 0.45, 0.6, "#454a5c");
    v.b(-0.3, 0.4, -3.3, 0.6, 0.45, 6.6, "#454a5c");
    const rotors: VoxModel[] = [];
    for (const [x, z] of [[-3.3, 0], [3.3, 0], [0, -3.3], [0, 3.3]] as const) {
      const r = vpart(drone, [x * U, 1.0 * U, z * U]);
      const rv = new Vx(r);
      rv.b(-0.35, -0.5, -0.35, 0.7, 0.6, 0.7, "#2b2f3a");
      rv.b(-1.7, 0.1, -0.18, 3.4, 0.14, 0.36, lit("#9fe9ff"));
      rv.b(-0.18, 0.1, -1.7, 0.36, 0.14, 3.4, lit("#9fe9ff"));
      rotors.push(r);
    }
    const eye = v.b(-0.5, 0.15, 1.6, 1, 0.8, 0.4, lit(PINK));
    tick((t, walking) => {
      rotors.forEach((r, i) => {
        r.rotation.y = t * 38 + i;
      });
      drone.position.y = 3.0 * U + Math.sin(t * 2.4) * 0.012 + (walking ? Math.abs(Math.sin(t * 11)) * 0.012 : 0);
      drone.rotation.y = Math.sin(t * 0.9) * 0.25;
      eye.visible = Math.sin(t * 5) > -0.6;
    });
  },
  // Paper lantern pack: a bamboo frame and a big lantern hanging out behind on a bracket, swaying as they walk.
  "Paper lantern pack": (b, tick) => {
    const v = new Vx(b);
    for (const x of [-2.6, 2.1]) v.b(x, -8.4, -0.7, 0.5, 8.8, 0.7, "#a8743a");
    v.b(-3.0, -1.4, -0.7, 6.0, 0.5, 0.7, "#c9a36a");
    v.b(-3.0, -7.6, -0.7, 6.0, 0.5, 0.7, "#c9a36a");
    v.b(-0.3, -1.4, -4.4, 0.6, 0.5, 3.8, "#a8743a");
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x, -7, 4, 0.8, 7.2, 0.45, RED);
      v.b(x, -0.6, 3.9, 0.8, 0.6, 0.55, RED);
    }
    const l = lantern(b, [0, -1.4, -4.3], 4.8, "#ff6a3c", "#8a1f18");
    swing({ tick }, l, 0, "x");
  },
  // Neon rain: a small violet storm cloud over the head with neon drops falling round the wearer, an underglow and flashes.
  "Neon rain": (b, tick) => {
    const cloud = vpart(b, [0, 12.5 * U, 2 * U]);
    const c = new Vx(cloud);
    c.b(-4.6, 0, -3.2, 9.2, 1.7, 6.4, "#5a4b86");
    c.b(-3.4, 1.7, -2.6, 6.8, 1.5, 5.2, "#6c5ba6");
    c.b(-5.8, 0.3, -2.0, 1.4, 1.2, 4.0, "#6c5ba6");
    c.b(4.4, 0.3, -2.0, 1.4, 1.2, 4.0, "#6c5ba6");
    c.b(-1.8, 3.2, -1.8, 3.6, 0.8, 3.6, "#8a7acb");
    c.b(-4.2, -0.2, -2.8, 8.4, 0.2, 5.6, lit(PINK));
    const flash = c.b(-1.2, 0.8, 3.15, 2.4, 0.5, 0.15, lit(CYAN));
    const rnd = seeded(202);
    const cols = [CYAN, PINK, "#b9a8ff", CYAN];
    const drops = Array.from({ length: 16 }, (_, i) => ({
      m: new Vx(b).b(0, 0, 0, 0.35, 1.5, 0.35, lit(cols[i % cols.length]!)),
      x: (rnd() - 0.5) * 9,
      z: 2 + (rnd() - 0.5) * 7,
      p: rnd(),
      v: 0.7 + rnd() * 0.4,
    }));
    const fall = (t: number, walking: boolean) => {
      cloud.position.y = 12.5 * U + Math.sin(t * 1.6) * 0.01;
      flash.visible = Math.sin(t * 3.7) > 0.82;
      for (const d of drops) {
        const k = (t * d.v * (walking ? 0.9 : 0.7) + d.p) % 1;
        d.m.position.set(d.x * U, (12 - k * 27) * U, d.z * U);
        d.m.scale.y = k > 0.9 ? (1 - k) * 10 : 1;
      }
    };
    fall(0, false);
    tick(fall);
  },
};
Object.assign(BACK_BUILDERS, BACKS);
