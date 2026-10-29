/**
 * Prestige track 2's outfit and back item in 3D (`core/src/prestige.ts`): the Nebula suit and the Orbital backpack,
 * in the same cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dPrestige2.ts`, it adds its builders
 * to the shop's tables: the outfit under its look index (`PRESTIGE_BASE + 1`), the back item under its name. The suit
 * paints every cube it shows, so it needs no entry in `data/gear.ts` to be midnight.
 */
import { PRESTIGE_BASE } from "@tokenmaxxing/core/prestige.ts";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
} from "./gear3dBody.ts";
import { lit, ring, see } from "./gear3dHead.ts";
import { U, Vx, vpart } from "./voxgear.ts";

/** Prestige II's look index. */
const COSMIC = PRESTIGE_BASE + 1;

const MID = "#16245a";
const MID_L = "#2a3f8f";
const MID_D = "#0d1740";
const NIGHT = "#0a1130";
const CYAN = "#22d3ee";
const GLOW = "#8cf0ff";
const PALE = "#e8f2ff";
const VIOLET = "#7a5cff";
const VIOLET_D = "#5a3fd0";
const PINK = "#e060ff";
const SAND = "#e8c58a";
const PLANET = "#6f7cf5";
const PLANET_L = "#aab4ff";

// MARK: Outfit

/** The nebula over a 3-pixel grid of `w`×`h` cells: a swirl of cyan through violet to pink on midnight, stars in it. */
function nebula(g: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  for (let y = 0; y < h; y += 3)
    for (let x = 0; x < w; x += 3) {
      const u = x / w;
      const v = y / h;
      // A band running corner to corner, twisted by a sine, and a second, fainter one across it.
      const d =
        Math.sin((u * 1.6 - v * 1.1 + seed) * Math.PI * 2) + 0.55 * Math.sin((u + v * 1.7) * 9 + seed * 5);
      let c = MID;
      if (d > 1.15) c = PINK;
      else if (d > 0.7) c = VIOLET;
      else if (d > 0.25) c = VIOLET_D;
      else if (d > -0.15) c = MID_L;
      else if (d < -1.25) c = CYAN;
      px(g, c, x, y, 3, 3);
    }
  // Stars: a fixed scatter, a few of them four-pointed.
  const stars: [number, number][] = [
    [6, 3],
    [24, 9],
    [45, 6],
    [12, 21],
    [33, 15],
    [51, 27],
    [18, 36],
    [39, 33],
    [3, 30],
  ];
  for (const [x, y] of stars) {
    if (x >= w || y >= h) continue;
    px(g, "#ffffff", x, y, 3, 3);
  }
  for (const [x, y] of [stars[1]!, stars[4]!, stars[7]!]) {
    if (x + 6 >= w || y + 6 >= h || x < 3 || y < 3) continue;
    px(g, GLOW, x - 3, y, 3, 3);
    px(g, GLOW, x + 3, y, 3, 3);
    px(g, GLOW, x, y - 3, 3, 3);
    px(g, GLOW, x, y + 3, 3, 3);
  }
}

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Nebula suit: a midnight suit, a nebula of cyan, violet and pink swirling across the chest and back, pricked with stars; a
  // cyan collar, a belt of starlight with a glowing star clasp, cyan-cuffed sleeves with a stripe down the arm. The star
  // clasp pulses and a few lit stars twinkle on the shoulders.
  0: (c) => {
    const v = grid(c);
    // A shell over the torso in midnight, so the suit is one colour whatever the wearer's catalogue colours say.
    v.b(-3.55, 0.4, -2.05, 7.1, 7.6, 4.1, MID);
    v.b(-3.6, 0.4, -2.1, 0.45, 7.6, 4.2, MID_D);
    v.b(3.15, 0.4, -2.1, 0.45, 7.6, 4.2, MID_D);
    marks(
      c,
      (g, w, h) => nebula(g, w, h, 0.1),
      (g, w, h) => nebula(g, w, h, 0.55),
    );
    roll(c, MID_L, 1.3, 0.4);
    roll(c, CYAN, 0.3, 0.45, 6.4);
    // The belt: a dark band with cyan studs and the star clasp at the front.
    v.b(-3.7, 0.2, -2.15, 7.4, 1.2, 4.3, NIGHT);
    for (let i = 0; i < 6; i++) v.b(-3.2 + i * 1.28, 0.7, 2.1, 0.5, 0.3, 0.2, CYAN);
    v.b(-1.0, 0.1, 2.15, 2.0, 1.4, 0.35, MID_L);
    const clasp = v.b(-0.5, 0.45, 2.45, 1.0, 0.7, 0.25, lit(GLOW));
    // A skirt hem of dark panels down over the trousers, a thin cyan line at the bottom of each.
    for (let i = 0; i < 7; i++) {
      v.b(-3.7 + i * 1.06, -1.9, 2.0, 0.95, 2.2, 0.4, i % 2 ? MID_D : MID);
      v.b(-3.7 + i * 1.06, -1.9, -2.4, 0.95, 2.2, 0.4, i % 2 ? MID_D : MID);
    }
    v.b(-3.75, -1.95, 2.0, 7.5, 0.22, 0.42, CYAN);
    v.b(-3.75, -1.95, -2.42, 7.5, 0.22, 0.42, CYAN);
    // Sleeves: midnight over the arms, a nebula-violet band at the shoulder, a cyan cuff, a cyan line down the outside.
    c.arms.forEach((arm, i) => {
      const a = new Vx(vpart(arm));
      const s = i ? 1 : -1;
      a.b(-1.2, -6.2, -1.2, 2.4, 6.0, 2.4, MID);
      a.b(-1.25, -2.3, -1.25, 2.5, 1.3, 2.5, VIOLET_D);
      a.b(-1.25, -1.5, -1.25, 2.5, 0.4, 2.5, PINK);
      a.b(-1.3, -6.5, -1.3, 2.6, 1.0, 2.6, MID_D);
      a.b(-1.3, -5.7, -1.3, 2.6, 0.28, 2.6, CYAN);
      a.b(s > 0 ? 1.12 : -1.38, -5.4, -0.25, 0.26, 4.0, 0.5, CYAN);
    });
    // A few lit stars on the shoulders and back that twinkle.
    const sparks = [
      v.b(-3.2, 7.0, 2.2, 0.55, 0.55, 0.3, lit("#ffffff")),
      v.b(2.6, 5.2, 2.2, 0.45, 0.45, 0.3, lit(GLOW)),
      v.b(-2.2, 4.4, -2.45, 0.55, 0.55, 0.3, lit("#ffffff")),
      v.b(2.4, 6.6, -2.45, 0.45, 0.45, 0.3, lit(GLOW)),
    ];
    c.tick((t) => {
      const k = 1 + Math.sin(t * 2.4) * 0.22;
      clasp.scale.set(k, k, 1);
      sparks.forEach((s, i) => {
        const tw = Math.max(0, Math.sin(t * 2.1 + i * 1.7)) ** 3;
        s.scale.setScalar(0.4 + tw * 1.3);
      });
    });
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[COSMIC + Number(n)] = build;

// MARK: Back

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Orbital backpack: a midnight rig on the back with a ringed planet set into its face, two thrusters that flicker
  // cyan, and a slow cyan orbit round the shoulders carrying a pale moon, a sand moon and a small ringed planet. The
  // orbit speeds up when they walk, and the thrusters flare.
  "Orbital backpack": (b, tick) => {
    const v = new Vx(b);
    // Straps over the shoulders and down the chest.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x, -7, 4, 1, 7.2, 0.5, NIGHT);
      v.b(x, -0.6, 3.9, 1, 0.6, 0.6, NIGHT);
      v.b(x, -1.2, -0.4, 1, 1.2, 0.5, NIGHT);
    }
    // The pack: a midnight shell with lighter panels, a cyan edge line and a dark top cap.
    v.b(-3.4, -8.2, -4.9, 6.8, 6.8, 4.7, MID);
    v.b(-3.5, -8.4, -5.0, 7.0, 0.7, 4.9, MID_D);
    v.b(-3.5, -1.8, -5.0, 7.0, 0.7, 4.9, MID_D);
    v.b(-3.5, -7.6, -5.0, 0.7, 5.8, 4.9, MID_D);
    v.b(2.8, -7.6, -5.0, 0.7, 5.8, 4.9, MID_D);
    v.b(-2.7, -7.2, -5.08, 5.4, 4.8, 0.2, MID_L);
    v.b(-3.0, -2.5, -5.12, 6.0, 0.22, 0.2, CYAN);
    v.b(-3.0, -7.4, -5.12, 6.0, 0.22, 0.2, CYAN);
    // The ringed planet on the face: a violet-blue ball with a pale cap, a cyan ring across it.
    v.b(-1.3, -6.2, -5.3, 2.6, 2.6, 0.3, PLANET);
    v.b(-1.0, -5.9, -5.45, 1.9, 1.9, 0.2, PLANET);
    v.b(-0.9, -4.6, -5.62, 1.0, 0.7, 0.15, PLANET_L);
    v.b(-2.5, -5.2, -5.7, 5.0, 0.28, 0.18, CYAN);
    v.b(-2.1, -5.55, -5.7, 4.2, 0.22, 0.18, GLOW);
    // A tiny star field on the shell.
    for (const [x, y] of [
      [-2.3, -3.4],
      [2.0, -4.0],
      [-2.0, -7.0],
      [2.2, -6.8],
      [1.4, -3.0],
    ] as const)
      v.b(x, y, -5.2, 0.35, 0.35, 0.15, lit("#ffffff"));
    // Two thrusters at the bottom, each a cone of dark metal with a cyan flame that flickers.
    const flames = [-1, 1].map((s) => {
      const x = s * 1.7;
      v.b(x - 0.7, -9.4, -4.3, 1.4, 1.2, 1.4, MID_L);
      v.b(x - 0.5, -9.9, -4.1, 1.0, 0.5, 1.0, NIGHT);
      const f = vpart(b, [x * U, -9.9 * U, -3.6 * U]);
      const fv = new Vx(f);
      fv.b(-0.4, -1.8, -0.4, 0.8, 1.8, 0.8, lit(CYAN));
      fv.b(-0.2, -2.8, -0.2, 0.4, 1.1, 0.4, lit(GLOW));
      return f;
    });
    // The orbit: a thin ring of light round the torso at shoulder height, and the three bodies riding it.
    const ctr = vpart(b, [0, -1.0 * U, 2.0 * U]);
    ring(ctr, see(CYAN, 0.35, true), 0.27, 0.004, [0, 0, 0], true);
    const spin = vpart(ctr);
    const R = 5.9 * U;
    const body = (a: number, build: (v: Vx) => void) => {
      const p = vpart(spin, [Math.sin(a) * R, 0, Math.cos(a) * R]);
      build(new Vx(p));
      return p;
    };
    // A pale moon with two craters.
    body(0, (m) => {
      m.b(-0.9, -0.9, -0.9, 1.8, 1.8, 1.8, "#dfe6f2");
      m.b(-0.7, -0.3, 0.85, 0.5, 0.5, 0.15, "#9aa6bd");
      m.b(0.1, -0.7, 0.85, 0.4, 0.4, 0.15, "#9aa6bd");
      m.b(-0.9, 0.5, -0.9, 1.8, 0.4, 1.8, PALE);
    });
    // A sand moon, smaller.
    body((Math.PI * 2) / 3, (m) => {
      m.b(-0.7, -0.7, -0.7, 1.4, 1.4, 1.4, SAND);
      m.b(-0.5, -0.1, 0.65, 0.4, 0.4, 0.15, "#b8935a");
      m.b(-0.7, 0.4, -0.7, 1.4, 0.3, 1.4, "#fff0c8");
    });
    // A small ringed planet: violet ball, cyan ring.
    body((Math.PI * 4) / 3, (m) => {
      m.b(-0.8, -0.8, -0.8, 1.6, 1.6, 1.6, PLANET);
      m.b(-0.8, 0.2, -0.8, 1.6, 0.5, 1.6, PLANET_L);
      m.b(-1.6, -0.2, -1.6, 3.2, 0.22, 3.2, CYAN);
    });
    tick((t, walking) => {
      spin.rotation.y = t * (walking ? 2.0 : 0.7);
      ctr.position.y = -1.0 * U + Math.sin(t * 1.3) * 0.004;
      flames.forEach((f, i) => {
        const k = walking ? 1.3 : 0.7;
        f.scale.y = k + Math.sin(t * 22 + i * 2) * 0.28 + Math.sin(t * 13 + i) * 0.14;
      });
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
