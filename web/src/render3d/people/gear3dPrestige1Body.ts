/**
 * Prestige track 1's body gear in 3D (`core/src/prestige.ts`): the Ascendant robes and the Runic cape, in the same
 * cubes as the rest of the wardrobe (`gear3dBody.ts`). Loaded by `gear3dPrestige1.ts`, it adds its builders to
 * `OUTFIT_BUILDERS` by look index and `BACK_BUILDERS` by name. Like every outfit and back they dress the blocky
 * torso only.
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
} from "./gear3dBody.ts";
import { lit } from "./gear3dHead.ts";
import { U, type VoxModel, Vx, vpart } from "./voxgear.ts";

const VIOLET = "#8b5cf6";
const VIOLET_ROBE = "#6d3fd0";
const VIOLET_DEEP = "#4c2a9c";
const VIOLET_DARK = "#34206b";
const SILVER = "#d6dbe6";
const SILVER_DARK = "#9aa3b8";
const GLOW = "#c4a8ff";
const WHITE = "#ffffff";

// MARK: Outfit

/** A rune on a 3-pixel grid at (x, y): a stem with a pair of arms, three variants so the robe's are not copies. */
const rune = (g: CanvasRenderingContext2D, color: string, x: number, y: number, kind: number) => {
  px(g, color, x, y, 3, 12);
  if (kind === 0) {
    px(g, color, x + 3, y + 3, 3, 3);
    px(g, color, x + 6, y, 3, 3);
  } else if (kind === 1) {
    px(g, color, x - 3, y + 3, 3, 3);
    px(g, color, x + 3, y + 6, 3, 3);
  } else {
    px(g, color, x - 3, y, 3, 3);
    px(g, color, x + 3, y, 3, 3);
    px(g, color, x, y + 6, 3, 3);
  }
};

/** A band of colour round an arm, `y` cubes down from the shoulder. */
const armBand = (c: BodyCtx, color: string, y: number, h: number, pad = 0) =>
  c.arms.forEach((arm) => {
    new Vx(vpart(arm)).b(-1.22 - pad, y, -1.22 - pad, 2.44 + 2 * pad, h, 2.44 + 2 * pad, color);
  });

// biome-ignore format: a catalogue reads best one to a line
const ROBES = (c: BodyCtx): void => {
  // The chest: a silver stripe down the middle with a violet collar either side, a line of runes in light on each
  // breast. The back carries one big rune and a chevron rising over it.
  marks(
    c,
    (g, _w, h) => {
      px(g, SILVER, 24, 0, 9, h);
      px(g, SILVER_DARK, 24, 0, 3, h);
      px(g, SILVER, 6, 0, 12, 3);
      px(g, SILVER, 39, 0, 12, 3);
      rune(g, GLOW, 9, 12, 0);
      rune(g, GLOW, 43, 12, 1);
      px(g, GLOW, 12, 27, 3, 3);
      px(g, GLOW, 42, 27, 3, 3);
      px(g, VIOLET_DARK, 21, 0, 3, h);
      px(g, VIOLET_DARK, 33, 0, 3, h);
      px(g, WHITE, 27, 15, 3, 3);
    },
    (g) => {
      for (let i = 0; i < 4; i++) {
        px(g, i % 2 ? GLOW : SILVER, 21 - i * 3, 6 + i * 3, 3, 3);
        px(g, i % 2 ? GLOW : SILVER, 33 + i * 3, 6 + i * 3, 3, 3);
      }
      px(g, GLOW, 27, 3, 3, 3);
      px(g, SILVER, 24, 21, 9, 3);
      rune(g, GLOW, 27, 24, 2);
    },
    true,
  );
  // A tall silver collar standing round the neck, and silver caps over the shoulders with a violet stone on each.
  roll(c, SILVER, 1.3, 0.55);
  const v = grid(c);
  v.b(-4.3, 6.9, -2.9, 0.8, 1.9, 5.8, SILVER_DARK);
  v.b(3.5, 6.9, -2.9, 0.8, 1.9, 5.8, SILVER_DARK);
  c.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    const a = new Vx(vpart(arm));
    a.b(-1.6, -0.5, -1.6, 3.2, 1.5, 3.2, SILVER);
    a.b(-1.3, 1.0, -1.3, 2.6, 0.5, 2.6, SILVER_DARK);
    a.b(s * 0.9 - 0.4, 1.2, 0.1, 0.8, 0.8, 0.8, lit(GLOW));
    // The sleeves are wide, flaring to a bell at the wrist with a silver edge.
    a.b(-1.45, -6.2, -1.45, 2.9, 2.6, 2.9, VIOLET_ROBE);
    a.b(-1.6, -7.2, -1.6, 3.2, 1.0, 3.2, VIOLET_DEEP);
    a.b(-1.7, -7.5, -1.7, 3.4, 0.5, 3.4, SILVER);
  });
  armBand(c, SILVER, -5.4, 0.45, 0.04);
  // The sash and the clasp: a silver belt with a stone of light at the front.
  v.b(-3.85, 0.1, -2.15, 7.7, 1.2, 4.3, SILVER);
  v.b(-3.9, 0.7, -2.2, 7.8, 0.35, 4.4, SILVER_DARK);
  v.b(-0.9, 0.0, 2.1, 1.8, 1.5, 0.5, SILVER_DARK);
  const stone = v.b(-0.45, 0.3, 2.45, 0.9, 0.9, 0.4, lit(GLOW));
  // The skirt: long violet robes to the shins in two layers, the front panel and the back one swaying apart as they
  // walk, silver at the hem and a dark violet lining where they open.
  const front = vpart(c.body, [0, 0, 0]);
  const back = vpart(c.body, [0, 0, 0]);
  const f = new Vx(front);
  const b = new Vx(back);
  for (const [x, w] of [
    [-3.95, 3.7],
    [0.25, 3.7],
  ] as const) {
    f.b(x, -4.2, 1.2, w, 4.5, 1.1, VIOLET_ROBE);
    f.b(x - 0.05, -4.2, 1.15, w + 0.1, 0.6, 1.2, SILVER);
    f.b(x, -3.5, 1.2, w, 0.3, 1.2, VIOLET_DEEP);
    b.b(x, -4.2, -2.3, w, 4.5, 1.1, VIOLET_DEEP);
    b.b(x - 0.05, -4.2, -2.35, w + 0.1, 0.6, 1.2, SILVER);
  }
  f.b(-0.25, -4.1, 1.15, 0.5, 4.4, 1.2, VIOLET_DARK);
  // A rune on each side of the front hem, in light.
  for (const x of [-2.9, 2.3]) f.b(x, -3.3, 2.28, 0.5, 1.9, 0.12, lit(GLOW));
  // Side panels so the robe reads as one garment from the side.
  for (const x of [-4.1, 3.6]) {
    b.b(x, -4.2, -2.3, 0.5, 4.5, 4.6, VIOLET_DEEP);
    b.b(x - 0.02, -4.2, -2.3, 0.54, 0.6, 4.6, SILVER);
  }
  c.tick((t, walking) => {
    const k = 0.5 + 0.5 * Math.sin(t * 2.4);
    stone.scale.setScalar(0.85 + k * 0.3);
    front.rotation.x = walking
      ? -0.06 - Math.abs(Math.sin(t * 11)) * 0.12
      : -0.02 - Math.sin(t * 1.5) * 0.012;
    back.rotation.x = walking
      ? 0.06 + Math.abs(Math.sin(t * 11 + 1)) * 0.1
      : 0.02 + Math.sin(t * 1.5) * 0.012;
  });
};
OUTFIT_BUILDERS[PRESTIGE_BASE] = ROBES;

// MARK: Back

/** A rune on the cape's outer face: bars as [x, y, w, h] from its centre line, in cubes, three shapes. */
// biome-ignore format: a catalogue reads best one to a line
const RUNES: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [
    [-0.15, 0.2, 0.3, 1.1],
    [0.15, 0.7, 0.6, 0.25],
  ],
  [
    [-0.15, 0.2, 0.3, 1.1],
    [-0.75, 0.2, 0.6, 0.25],
    [0.15, 0.55, 0.6, 0.25],
  ],
  [
    [-0.15, 0.2, 0.3, 1.1],
    [-0.6, 0.85, 0.45, 0.25],
    [0.15, 0.85, 0.45, 0.25],
  ],
];

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Runic cape: a long violet cape hung from silver shoulder clasps, each row of it hanging off the one above so it
  // ripples; a silver lining shows down both edges and a silver hem finishes it. A rune sits on each lower row and
  // glows brighter the faster the wearer goes.
  "Runic cape": (b, tick) => {
    const v = new Vx(b);
    // The clasps on the shoulders, a silver chain across the chest and a stone at its middle.
    for (const s of [-1, 1]) {
      v.b(s > 0 ? 3.0 : -4.4, -1.6, -0.9, 1.4, 1.6, 5.4, SILVER);
      v.b(s > 0 ? 3.2 : -4.2, -0.3, -0.7, 1.0, 0.5, 5.0, SILVER_DARK);
      v.b(s > 0 ? 3.5 : -4.3, -2.3, 0.4, 0.8, 1.4, 1.8, SILVER_DARK);
    }
    v.b(-3.6, -1.6, 3.8, 7.2, 0.5, 0.6, SILVER);
    v.b(-3.6, -2.2, 3.9, 7.2, 0.4, 0.5, SILVER_DARK);
    v.b(-0.8, -2.5, 4.1, 1.6, 1.6, 0.5, SILVER);
    const stone = v.b(-0.45, -2.1, 4.5, 0.9, 0.9, 0.4, lit(GLOW));
    // The cape: six rows, each wider than the last, hung from the one above.
    const rows = 6;
    const steps: VoxModel[] = [];
    const dim = new THREE.Color("#7f66c9");
    const bright = new THREE.Color("#f2e8ff");
    const runeMat = new THREE.MeshBasicMaterial({ color: dim });
    let at = vpart(b, [0, -0.25 * U, -0.05 * U]);
    for (let i = 0; i < rows; i++) {
      const w = 7.6 + i * 0.7;
      const h = 1.5;
      const x0 = -w / 2;
      const mid = i % 2 ? VIOLET_ROBE : VIOLET;
      const hem = i === rows - 1;
      const cv = new Vx(at);
      // The body of the row, in two violet tones, with a silver lining down each edge.
      cv.b(x0 + 0.7, -h, -0.9, w - 1.4, h, 0.9, mid);
      cv.b(x0, -h, -0.9, 0.7, h, 0.9, SILVER);
      cv.b(x0 + w - 0.7, -h, -0.9, 0.7, h, 0.9, SILVER);
      if (hem) cv.b(x0, -h, -1.0, w, 0.5, 1.0, SILVER);
      // A darker fold down the middle of every other row.
      if (i % 2) cv.b(-0.4, -h + 0.1, -1.0, 0.8, h - 0.2, 0.15, VIOLET_DEEP);
      // A rune on each of the 3rd to 5th rows, lit, offset from the middle so they are not a column.
      if (i >= 2 && i <= 4)
        for (const [rx, ry, rw, rh] of RUNES[i - 2]!)
          cv.b((i - 3) * 1.6 + rx, -h + ry - 0.1, -1.05, rw, rh, 0.15, runeMat);
      const next = vpart(at, [0, -h * U, 0]);
      steps.push(at);
      at = next;
    }
    tick((t, walking) => {
      steps.forEach((s, i) => {
        s.rotation.x = walking
          ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.09 * (i ? 0.7 : 1.3) + Math.sin(t * 11 - i * 0.8) * 0.05 * i
          : 0.03 + (Math.sin(t * 1.6 - i * 0.6) + 1) * 0.016 * (i + 1);
      });
      const k = walking ? 1 : 0.35 + 0.25 * Math.sin(t * 2);
      runeMat.color.lerpColors(dim, bright, k);
      stone.scale.setScalar(0.85 + (0.5 + 0.5 * Math.sin(t * 2.4)) * 0.3);
    });
  },
};
Object.assign(BACK_BUILDERS, BACKS);
