/**
 * Prestige track 5's body gear in 3D (`core/src/prestige.ts`): the Prismatic regalia and the Aurora wings, in the same
 * cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dPrestige5.ts`, it adds its outfit to
 * `OUTFIT_BUILDERS` under the track's look index (`PRESTIGE_BASE + 4`) and its wings to `BACK_BUILDERS` by name. The
 * regalia paints its own pearl over the torso, so it does not depend on an entry in `data/gear.ts`.
 */
import { PRESTIGE_BASE } from "@tokenmaxxing/core/prestige.ts";
import * as THREE from "three";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
  tails,
} from "./gear3dBody.ts";
import { lit } from "./gear3dHead.ts";
import { shimmer } from "./gear3dPrestige5Aura.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const PEARL = "#f4f0ff";
const PEARL_SHADE = "#cfc6ea";
const LILAC = "#8a7fc0";
const PINK = "#ff7ad9";
/** Red to pink, as the 2D art has them (`art/prestige-5.ts`). */
const SPECTRUM = ["#ff5d73", "#ff9a4d", "#ffe066", "#5df0a0", "#5fe0ff", "#6f9bff", "#a78bfa"];

// MARK: Outfit

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Prismatic regalia: a pearl robe with a pearl collar, a sash of the whole spectrum from shoulder to hip, a belt with the
  // spectrum across its front and back, a prism brooch at the breast that runs through the colours, and pearl cuffs. From
  // behind a prism throws a fan of light across the back.
  4: (c) => {
    const spark = (g: CanvasRenderingContext2D, x: number, y: number) => {
      px(g, PEARL_SHADE, x, y, 3, 3);
      px(g, "#ffffff", x + 1, y - 3, 1, 9);
      px(g, "#ffffff", x - 3, y + 1, 9, 1);
    };
    marks(
      c,
      (g) => {
        for (const [x, y] of [
          [9, 9],
          [48, 6],
          [45, 33],
        ] as const)
          spark(g, x, y);
      },
      (g, w, h) => {
        // A prism on the back: a pearl triangle and seven bands of colour fanning out of its right side.
        const cx = Math.floor(w / 2);
        for (let y = 5; y < h - 5; y++) {
          const half = Math.floor((y - 5) * 0.42);
          px(g, PEARL, cx - 3 - half, y, 6 + half * 2, 1);
        }
        SPECTRUM.forEach((col, i) => px(g, col, cx + 5, 10 + i * 3, w - cx - 10, 3));
        px(g, "#ffffff", cx - 1, 7, 2, h - 14);
      },
    );
    const v = grid(c);
    // The robe, over whatever the torso is: pearl all round, a lilac collar and shoulders.
    v.b(-3.55, 0, -2.05, 7.1, 8, 4.1, PEARL);
    v.b(-3.6, 7.3, -2.1, 7.2, 0.7, 4.2, PEARL_SHADE);
    roll(c, LILAC, 0.8, 0.5);
    c.sleeves(PEARL);
    c.arms.forEach((arm) => {
      const a = new Vx(vpart(arm));
      a.b(-1.3, -6.2, -1.3, 2.6, 1.0, 2.6, LILAC);
      a.b(-1.3, -6.9, -1.3, 2.6, 0.3, 2.6, PINK);
    });
    // The belt, the spectrum along its front and back.
    v.b(-3.8, 0.2, -2.3, 7.6, 1.2, 4.6, LILAC);
    SPECTRUM.forEach((col, i) => {
      const x = -3.5 + i * 1.0;
      v.b(x, 0.35, 2.28, 1.0, 0.9, 0.2, col);
      v.b(x, 0.35, -2.48, 1.0, 0.9, 0.2, col);
    });
    // The sash: a staircase of colour from the right shoulder to the left hip, each step a colour of the spectrum.
    SPECTRUM.forEach((col, i) => {
      v.b(-3.1 + i * 0.9, 6.6 - i * 0.95, 2.1, 1.5, 1.3, 0.3, col);
    });
    // The brooch: a stepped diamond whose stone runs through every colour, in a pearl setting.
    const stone = lit(PINK);
    const g = vpart(c.body, [0, 4.9 * U, 2.45 * U]);
    const b = new Vx(g);
    b.b(-1.1, -1.1, -0.1, 2.2, 2.2, 0.35, PEARL_SHADE);
    for (const [w, h] of [
      [0.5, 1.8],
      [1.2, 1.2],
      [1.8, 0.5],
    ] as const)
      b.b(-w / 2, -h / 2, 0.15, w, h, 0.3, stone);
    // The skirt: pearl tails behind, hemmed in pink.
    tails(c, PEARL, 3.2, PINK);
    c.tick((t) => shimmer(stone, 0, t * 1.5, 0.7));
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[PRESTIGE_BASE + Number(n)] = build;

// MARK: Back

/** Feather colours, top of the wing to the tip: green, cyan, blue, violet, pink and a pearl tip. */
const FEATHERS = ["#5df0a0", "#5fe0ff", "#6f9bff", "#a78bfa", "#ff7ad9", "#f4f0ff"];
const FEATHER_LEN = [10, 10.6, 10, 9.2, 8.2, 7];

/** One wing: a fan of broad feathers from the shoulder, long ones in the spectrum and pale coverts over their roots. */
function wing(b: VoxModel, side: 1 | -1, glints: THREE.Material[]): { root: VoxModel; feathers: VoxModel[] } {
  const root = vpart(b, [side * 1.6 * U, -1.2 * U, -1.3 * U]);
  root.rotation.y = side * 0.55;
  const feathers: VoxModel[] = [];
  const at = (x: number, w: number) => (side > 0 ? x : -x - w);
  FEATHERS.forEach((col, i) => {
    const f = vpart(root, [0, 0, 0.02 * i]);
    // Fanned from raised (the top feather) to level, so the wing opens like a hand.
    f.rotation.z = side * (1.0 - i * 0.21);
    const len = FEATHER_LEN[i]!;
    const v = new Vx(f);
    v.b(at(0.2, len), -1.0, -0.25, len, 2.0, 0.5, col);
    // A pale edge along the top, and a glint at the tip that runs the spectrum.
    v.b(at(0.2, len), 0.8, -0.3, len * 0.92, 0.3, 0.6, i === 5 ? "#ffffff" : PEARL);
    const tip = lit("#ffffff");
    glints.push(tip);
    v.b(at(len - 0.9, 1.1), -0.8, -0.4, 1.1, 1.6, 0.7, tip);
    feathers.push(f);
  });
  // The coverts: two rows of shorter pale feathers over the roots of the long ones.
  for (let i = 0; i < 2; i++) {
    const f = vpart(root, [0, 0, -0.45 - 0.05 * i]);
    f.rotation.z = side * (0.85 - i * 0.5);
    const v = new Vx(f);
    const len = 4.6 - i * 1.0;
    v.b(at(0.2, len), -0.6, -0.15, len, 1.2, 0.4, i ? "#ffd1f2" : "#e4dcff");
    v.b(at(0.2, len), -0.7, -0.1, len, 0.2, 0.5, PEARL);
    feathers.push(f);
  }
  return { root, feathers };
}

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Aurora wings: a pair of wings of folded light, a feather to a colour from green at the top through cyan, blue and violet
  // to pink at the tips, with pearl coverts and a glint at each tip that runs the spectrum. Pearl straps and a mount at the
  // shoulder blades hold them. At rest they breathe; walking, they beat.
  "Aurora wings": (b, tick) => {
    const v = new Vx(b);
    // Straps over the shoulders down the chest, and the mount between the blades.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 1.7 : -2.7;
      v.b(x + 0.2, -7, 4, 0.6, 7.2, 0.4, PEARL_SHADE);
      v.b(x + 0.2, -0.6, 3.9, 0.6, 0.6, 0.6, PEARL_SHADE);
      v.b(x + 0.2, -1.2, -0.4, 0.6, 1.2, 0.5, PEARL_SHADE);
    }
    v.b(-2.0, -3.6, -1.5, 4, 3.4, 1.0, PEARL);
    v.b(-2.2, -3.8, -1.6, 4.4, 0.5, 1.2, LILAC);
    const jewel = lit(PINK);
    v.b(-0.7, -2.7, -2.5, 1.4, 1.4, 0.4, jewel);

    const glints: THREE.Material[] = [];
    const wings = [wing(b, 1, glints), wing(b, -1, glints)];
    const base = wings.map((w) => w.feathers.map((f) => f.rotation.z));
    tick((t, walking) => {
      const beat = walking ? Math.sin(t * 9) * 0.22 : Math.sin(t * 1.4) * 0.05;
      wings.forEach((w, wi) => {
        const side = wi ? -1 : 1;
        w.root.rotation.y = side * (0.55 + (walking ? 0.12 : 0.03) + beat * 0.6);
        w.feathers.forEach((f, i) => {
          // The feathers ripple one after another down the wing.
          f.rotation.z =
            base[wi]![i]! +
            side * (Math.sin(t * (walking ? 9 : 1.6) - i * 0.5) * (walking ? 0.05 : 0.02) + beat * 0.3);
        });
      });
      glints.forEach((g, i) => shimmer(g, (i % 6) / 6, t * 1.5, 0.75));
      shimmer(jewel, 0.8, t * 1.5, 0.7);
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
