/**
 * The Julemarked's coin stalls in 3D (`core/src/julemarked-shop.ts`): Den varme bod's earmuffs and two outfits,
 * Julegodter's five things to hold. Loaded by `gear3d.ts`; it adds its builders to the shop's tables (hat and held by
 * name, outfits under `STALL_BASE + n`; outfit colours are in `data/gear.ts`). Everything is built from sharp boxes
 * (and stepped boxes), as the Voxel style wants: no spheres, tori or cylinders. Brief: `docs/cases/julemarked.md`.
 */
import { STALL_BASE } from "@tokenmaxxing/core/julemarked-shop.ts";
import type * as THREE from "three";
import type { Model } from "../kit/kit.ts";
import {
  BACK_BUILDERS,
  type BackBuilder,
  type BodyCtx,
  grid,
  HELD_BUILDERS,
  type HeldBuilder,
  marks,
  OUTFIT_BUILDERS,
  px,
  roll,
} from "./gear3dBody.ts";
import { COVERS_HAIR, EYE_Y, eyeAt, FACE_BUILDERS, HAT_BUILDERS, lit, see } from "./gear3dHead.ts";
import { isVox, U, Vx, vpart } from "./voxgear.ts";

const RED = "#b8302c";
const RED_DARK = "#8f2421";
const CREAM = "#f4ecd8";
const CREAM_DARK = "#d9cdb0";
const WHITE = "#ffffff";
const GOLD = "#f2c14e";
const WOOD = "#a06a3c";
const PEBER = "#6b3f22";
const KNIT_DARK = "#486577";
const CAMEL = "#a8794a";
const CAMEL_DARK = "#86603a";
const FUR = "#7a5436";
const FUR_DARK = "#5a3b24";
const FUR_LIGHT = "#a37a52";
const TWEED = "#5d6670";
const TWEED_DARK = "#444c55";
const TWEED_LIGHT = "#7b8590";
const RAIN = "#f3c623";
const RAIN_DARK = "#d19f12";
const RAIN_LIGHT = "#ffe27a";
const INK = "#1d1a1c";
const STEEL = "#b9c2ca";
const STEEL_DARK = "#8893a0";
const T = 0.004; // the corner radius of a "sharp" box

// MARK: Hat

/** Wool earmuffs: a stepped band over the crown, a cream fluffy cup over each ear with a red heart-of-wool centre. */
function oreVaermere(m: Model): void {
  // The grown head is a little shorter than the blocky one: the band sits lower on it.
  const top = isVox(m) ? 0.31 : 0.225;
  m.box([0.56, 0.045, 0.1], RED_DARK, [0, top, 0], T);
  for (const s of [-1, 1]) {
    m.box([0.045, top - 0.09, 0.1], RED_DARK, [s * 0.275, (top + 0.09) / 2, 0], T);
    m.box([0.045, 0.12, 0.1], RED_DARK, [s * 0.275, 0.09, 0], T);
    // The cup: a cream block, a darker rim, a red wool centre on the outside.
    m.box([0.06, 0.18, 0.18], CREAM, [s * 0.29, -0.03, 0], T);
    m.box([0.064, 0.15, 0.15], CREAM_DARK, [s * 0.288, -0.03, 0], T);
    m.box([0.066, 0.12, 0.12], CREAM, [s * 0.296, -0.03, 0], T);
    m.box([0.07, 0.06, 0.06], RED, [s * 0.299, -0.03, 0], T);
  }
}

/**
 * Pelshue: a fur trapper hat. A stepped crown with a fur band round the brow, and the flaps down over the ears with
 * a few darker tufts on the tips, tied loosely under the chin with two cords.
 */
function pelshue(m: Model): void {
  const vox = isVox(m);
  const top = vox ? 0.325 : 0.24;
  const w = vox ? 0.6 : 0.56;
  const d = vox ? 0.58 : 0.56;
  // The crown: two steps and a flat top.
  m.box([w - 0.04, 0.1, d - 0.04], FUR, [0, top - 0.03, 0], T);
  m.box([w - 0.14, 0.04, d - 0.14], FUR_LIGHT, [0, top + 0.04, 0], T);
  m.box([w - 0.26, 0.03, d - 0.26], FUR, [0, top + 0.075, 0], T);
  // The brow band, front and back thicker, with tufts that stick up a little.
  const by = top - 0.115;
  m.box([w, 0.075, d], FUR_DARK, [0, by, 0], T);
  m.box([w + 0.01, 0.03, d + 0.01], FUR, [0, by + 0.03, 0], T);
  for (const [x, z] of [
    [-0.2, 1],
    [-0.07, 1],
    [0.08, 1],
    [0.21, 1],
    [-0.15, -1],
    [0.1, -1],
  ] as const)
    m.box([0.07, 0.03, 0.04], FUR_LIGHT, [x, by + 0.055, z * (d / 2)], 0.002);
  // The flaps over the ears: a thick slab hanging down each side from the band, a darker lining inside, tufty tips.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.03);
    m.box([0.1, 0.3, 0.34], FUR, [x, by - 0.15, 0.0], T);
    m.box([0.012, 0.25, 0.28], FUR_DARK, [x - s * 0.052, by - 0.15, 0.0], T);
    m.box([0.11, 0.05, 0.3], FUR_LIGHT, [x + s * 0.004, by - 0.04, 0.0], T);
    for (const z of [-0.11, 0.0, 0.11]) m.box([0.1, 0.06, 0.07], FUR_DARK, [x, by - 0.31, z], 0.002);
    // The cord, hanging from the flap tip.
    m.box([0.02, 0.1, 0.02], RED_DARK, [x - s * 0.02, by - 0.37, 0.14], 0.002);
    m.box([0.034, 0.03, 0.034], RED, [x - s * 0.02, by - 0.43, 0.14], 0.002);
  }
}

/**
 * Sixpence: a flat wool cap. A low band, a wide soft crown that tips forward in two steps, a button on top and a
 * short stiff peak in front. A faint tweed fleck of lighter and darker blocks.
 */
function sixpence(m: Model): void {
  const vox = isVox(m);
  const top = vox ? 0.32 : 0.25;
  const w = vox ? 0.58 : 0.55;
  const d = vox ? 0.58 : 0.55;
  m.box([w, 0.07, d], TWEED_DARK, [0, top - 0.1, 0], T);
  // The soft crown, wider than the band, sloping forward.
  m.box([w + 0.04, 0.06, d + 0.02], TWEED, [0, top - 0.04, 0.01], T);
  m.box([w + 0.01, 0.045, d - 0.02], TWEED, [0, top + 0.015, 0.04], T);
  m.box([w - 0.1, 0.03, d - 0.1], TWEED_LIGHT, [0, top + 0.05, 0.05], T);
  m.box([0.045, 0.03, 0.045], TWEED_DARK, [0, top + 0.08, 0.04], 0.002);
  // The tweed: scattered flecks on the crown.
  for (const [x, z, c] of [
    [-0.2, 0.0, TWEED_LIGHT],
    [-0.08, 0.14, TWEED_DARK],
    [0.1, 0.08, TWEED_LIGHT],
    [0.2, -0.04, TWEED_DARK],
    [-0.14, -0.12, TWEED_DARK],
    [0.06, -0.14, TWEED_LIGHT],
    [0.16, 0.18, TWEED_LIGHT],
    [-0.22, 0.17, TWEED_LIGHT],
  ] as const)
    m.box([0.04, 0.008, 0.04], c, [x, top + 0.02 + (Math.abs(x) < 0.12 ? 0.015 : 0), z + 0.04], 0.001);
  // The peak: a short stiff slab, dipped a little, over the brow.
  const peak = m.box([0.4, 0.02, 0.17], TWEED_DARK, [0, top - 0.115, d / 2 + 0.07], T);
  peak.rotation.x = 0.12;
  m.box([0.4, 0.014, 0.02], "#2e343b", [0, top - 0.128, d / 2 + 0.14], 0.002);
  // A stitched seam on the band.
  m.box([w + 0.005, 0.008, d + 0.005], TWEED_LIGHT, [0, top - 0.07, 0], 0.001);
}

Object.assign(HAT_BUILDERS, {
  Øreværmere: (m: Model) => oreVaermere(m),
  Pelshue: (m: Model) => pelshue(m),
  Sixpence: (m: Model) => sixpence(m),
});
for (const n of ["Pelshue", "Sixpence"]) COVERS_HAIR.add(n);

// MARK: Glasses

const SHELL = "#8a4b1e";
const SHELL_DARK = "#3d2210";
const SHELL_AMBER = "#cf8b3a";

/**
 * A strap round the head at eye height. The face frame is pushed to the front of the skull and stretched, so the
 * skull's side and back are found from the frame's own scale and position.
 */
function strap(m: Model, h: number, color: string): void {
  const sc = m.scale.y || 1;
  const wide = (m.scale.x || 1) / sc;
  const x = 0.262 / wide;
  const zb = -0.262 - m.position.z / sc;
  const vox = isVox(m);
  for (const s of [-1, 1]) {
    m.box([0.026 / wide, h, 0.26], color, [s * x, EYE_Y, 0.0], 0.004);
    m.box([0.026 / wide, h, -zb - 0.1 - 0.02], color, [s * x, EYE_Y, (zb - 0.1) / 2 - 0.02], 0.004);
    if (vox) m.box([0.026 / wide, h, 0.026], color, [s * x, EYE_Y, zb], 0.004);
    else {
      const d = m.box([0.15, h, 0.026], color, [(s * 0.19) / wide, EYE_Y, zb + 0.02], 0.004);
      d.rotation.y = s * 0.7;
    }
  }
  m.box([0.34 / wide, h, 0.026], color, [0, EYE_Y, zb], 0.004);
}

/** Skibriller: one wide mirrored lens in a chunky frame, a gold-to-blue mirror sheen and a strap round the head. */
function skibriller(m: Model): void {
  const w = 0.17;
  const h = 0.105;
  for (const s of [-1, 1] as const) {
    const e = eyeAt(m, s);
    e.box([w, h, 0.03], INK, [0, 0, 0.004], 0.006);
    // The mirror: gold on top, a blue-violet band lower down, a pale glint.
    e.box([w - 0.03, h - 0.03, 0.012], "#e8a23c", [0, 0.0, 0.02], 0.003);
    e.box([w - 0.03, 0.045, 0.014], "#c4506a", [0, -0.012, 0.021], 0.003);
    e.box([w - 0.03, 0.02, 0.016], "#4a74c9", [0, -0.03, 0.022], 0.003);
    e.box([0.05, 0.012, 0.018], "#fff3d0", [-0.035 * s, 0.025, 0.027], 0.002);
    e.box([0.02, 0.012, 0.018], "#fff3d0", [-0.07 * s, 0.025, 0.027], 0.002);
    // The foam under the frame.
    e.box([w + 0.01, 0.014, 0.02], RAIN, [0, -h / 2 - 0.003, -0.008], 0.003);
  }
  const bar = isVox(m) ? 0.254 : 0.24;
  m.box([0.06, 0.07, 0.03], INK, [0, EYE_Y, bar], 0.006);
  strap(m, 0.07, "#2b3a52");
}

/** One round lens built blocky: an octagon of tortoiseshell blocks, dark at the corners, round a clear gap. */
function shellRim(e: Model): void {
  const r = 0.068;
  const t = 0.02;
  e.box([0.09, t, 0.016], SHELL, [0, r, 0], 0.003);
  e.box([0.09, t, 0.016], SHELL, [0, -r, 0], 0.003);
  e.box([t, 0.09, 0.016], SHELL, [-r, 0, 0], 0.003);
  e.box([t, 0.09, 0.016], SHELL, [r, 0, 0], 0.003);
  for (const [sx, sy] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ] as const)
    e.box([0.036, 0.036, 0.016], SHELL_DARK, [sx * 0.052, sy * 0.052, 0], 0.003);
  // One amber fleck on the top of the rim.
  e.box([0.03, 0.012, 0.018], SHELL_AMBER, [0.0, r, 0.001], 0.002);
}

/** Hyggebriller: round tortoiseshell specs, blocky, with a keyhole bridge and thin arms. */
function hyggebriller(m: Model): void {
  for (const s of [-1, 1] as const) shellRim(eyeAt(m, s));
  const bar = isVox(m) ? 0.25 : 0.238;
  m.box([0.06, 0.016, 0.016], SHELL_DARK, [0, EYE_Y + 0.02, bar], 0.003);
  const x = isVox(m) ? 0.2 : 0.255;
  for (const s of [-1, 1]) {
    const o = m.box([0.016, 0.02, 0.2], SHELL, [s * x, EYE_Y + 0.02, 0.1], 0.004);
    if (!isVox(m)) o.rotation.y = s * -0.12;
  }
}

Object.assign(FACE_BUILDERS, {
  Skibriller: (m: Model) => skibriller(m),
  Hyggebriller: (m: Model) => hyggebriller(m),
});

// MARK: Held

// biome-ignore format: a catalogue reads best one to a line
const HELD: Record<string, HeldBuilder> = {
  // A red mug with a cream band, thick cocoa topped with stepped whipped cream, a chocolate dust, steam.
  "Varm kakao": (h, tick) => {
    const z = 0.06;
    h.box([0.085, 0.09, 0.085], RED, [0, 0.0, z], T);
    h.box([0.088, 0.022, 0.088], CREAM, [0, 0.028, z], T);
    h.box([0.07, 0.006, 0.07], PEBER, [0, 0.046, z], T);
    h.box([0.06, 0.02, 0.06], WHITE, [0, 0.058, z], T);
    h.box([0.04, 0.02, 0.04], WHITE, [0, 0.076, z], T);
    h.box([0.02, 0.016, 0.02], WHITE, [0, 0.092, z], T);
    for (const [x, zz] of [
      [-0.016, 0.014],
      [0.02, -0.01],
      [0.0, -0.022],
    ] as const)
      h.box([0.008, 0.004, 0.008], PEBER, [x, 0.069, z + zz], 0.001);
    // The handle, a square C on the right.
    h.box([0.024, 0.014, 0.02], CREAM, [0.054, 0.025, z], T);
    h.box([0.024, 0.014, 0.02], CREAM, [0.054, -0.022, z], T);
    h.box([0.014, 0.06, 0.02], CREAM, [0.065, 0.002, z], T);
    const puffs = [0, 1].map(() => h.box([0.02, 0.02, 0.02], lit(WHITE), [0, 0.11, z], 0.002));
    tick((t) =>
      puffs.forEach((p, i) => {
        const k = (t * 0.6 + i / 2) % 1;
        p.position.set(Math.sin(k * 8 + i * 3) * 0.012, 0.11 + k * 0.12, z);
        p.scale.setScalar(Math.max(0.01, 1 - k * 0.7));
      }),
    );
  },
  // A cream paper plate with two sugar-dusted knots of fried dough, each a stepped diamond with a hole.
  Klejner: (h) => {
    const z = 0.08;
    h.box([0.16, 0.012, 0.13], CREAM, [0, 0.0, z], T);
    h.box([0.16, 0.014, 0.012], RED, [0, 0.002, z + 0.062], T);
    for (const cx of [-0.036, 0.04]) {
      const k = h.part([cx, 0.012, z + (cx < 0 ? 0.008 : -0.006)]);
      const u = 0.014;
      // Rows of a diamond ring: [x, rowIndex, width in u].
      const rows: [number, number][][] = [
        [[0, 1]],
        [
          [-1, 1],
          [1, 1],
        ],
        [
          [-2, 1],
          [2, 1],
        ],
        [
          [-1, 1],
          [1, 1],
        ],
        [[0, 1]],
      ];
      rows.forEach((row, r) => {
        for (const [x, w] of row) {
          k.box([w * u, 0.022, u], r % 2 ? "#d49a46" : "#c98a3c", [x * u, 0.011, (r - 2) * u], 0.002);
          k.box([w * u * 0.6, 0.004, u * 0.6], WHITE, [x * u, 0.024, (r - 2) * u], 0.001);
        }
      });
      k.box([u * 3.4, 0.012, u * 0.7], "#c98a3c", [0, 0.01, 0], 0.002);
    }
  },
  // A cream bowl with a red band, white porridge heaped in steps, a pat of butter, cinnamon dots, a wooden spoon.
  "Risengrød med smør": (h, tick) => {
    const z = 0.06;
    h.box([0.06, 0.012, 0.06], CREAM_DARK, [0, -0.04, z], T);
    h.box([0.09, 0.04, 0.09], CREAM, [0, -0.016, z], T);
    h.box([0.108, 0.032, 0.108], CREAM, [0, 0.02, z], T);
    h.box([0.112, 0.014, 0.112], RED, [0, 0.016, z], T);
    h.box([0.1, 0.012, 0.1], "#fbf6ea", [0, 0.044, z], T);
    h.box([0.072, 0.014, 0.072], "#fbf6ea", [0, 0.056, z], T);
    h.box([0.04, 0.012, 0.04], WHITE, [0, 0.067, z], T);
    h.box([0.03, 0.014, 0.024], GOLD, [0.004, 0.077, z + 0.002], T);
    for (const [x, zz] of [
      [-0.03, 0.02],
      [0.02, -0.03],
      [-0.012, -0.024],
      [0.03, 0.026],
      [-0.036, -0.012],
    ] as const)
      h.box([0.007, 0.004, 0.007], "#8a4a26", [x, 0.064, z + zz], 0.001);
    const sp = h.part([0.03, 0.06, z + 0.012]);
    sp.rotation.z = -0.5;
    sp.box([0.012, 0.1, 0.012], WOOD, [0, 0.03, 0], T);
    sp.box([0.03, 0.018, 0.012], WOOD, [0, 0.085, 0], T);
    const puff = h.box([0.016, 0.016, 0.016], lit(WHITE), [-0.02, 0.1, z], 0.002);
    tick((t) => {
      const k = (t * 0.6) % 1;
      puff.position.set(-0.02 + Math.sin(k * 8) * 0.01, 0.1 + k * 0.1, z);
      puff.scale.setScalar(Math.max(0.01, 1 - k * 0.7));
    });
  },
  // A loaf of pale marzipan under a slab of dark chocolate, one thin slice cut off and a gold ribbon of leaf.
  Marcipanbrød: (h) => {
    const z = 0.07;
    h.box([0.15, 0.052, 0.07], "#e6c9a0", [0, 0.0, z], T);
    h.box([0.154, 0.024, 0.074], "#4a2a1a", [0, 0.036, z], T);
    h.box([0.154, 0.004, 0.074], "#6b3f22", [0, 0.05, z], T);
    for (const x of [-0.04, 0.02, 0.06]) h.box([0.012, 0.004, 0.076], "#6b3f22", [x, 0.052, z], 0.001);
    h.box([0.154, 0.01, 0.01], GOLD, [0, 0.012, z + 0.037], 0.002);
    // The cut slice, leaning against the end.
    h.box([0.012, 0.05, 0.07], "#f0d8b4", [0.086, 0.0, z], T);
    h.box([0.014, 0.022, 0.074], "#4a2a1a", [0.086, 0.036, z], T);
  },
  // A candy cane: a straight shaft of red and white bands and a squared hook at the top.
  Sukkerstang: (h) => {
    const z = 0.06;
    const w = 0.026;
    for (let i = 0; i < 8; i++) h.box([w, 0.022, w], i % 2 ? WHITE : RED, [0, -0.03 + i * 0.022, z], 0.002);
    for (let i = 0; i < 3; i++) h.box([w, w, w], i % 2 ? WHITE : RED, [-i * w, 0.15, z], 0.002);
    h.box([w, w, w], WHITE, [-2 * w, 0.124, z], 0.002);
    h.box([w, w, w], RED, [-2 * w, 0.098, z], 0.002);
  },
};
// biome-ignore format: a catalogue reads best one to a line
Object.assign(HELD, {
  // A dented steel flask: a stepped body with a dark band, a red cup-lid, a screw collar, a side handle and steam.
  Termokande: (h, tick) => {
    const z = 0.06;
    h.box([0.07, 0.17, 0.07], STEEL, [0, 0.0, z], T);
    h.box([0.074, 0.012, 0.074], STEEL_DARK, [0, -0.06, z], T);
    h.box([0.074, 0.012, 0.074], STEEL_DARK, [0, 0.01, z], T);
    h.box([0.074, 0.03, 0.074], INK, [0, -0.085, z], T);
    // The lid cup and collar.
    h.box([0.075, 0.016, 0.075], STEEL_DARK, [0, 0.092, z], T);
    h.box([0.066, 0.04, 0.066], RED, [0, 0.118, z], T);
    h.box([0.05, 0.012, 0.05], RED_DARK, [0, 0.142, z], T);
    // A bright edge and a dent on the side.
    h.box([0.012, 0.15, 0.012], "#e4eaef", [-0.026, 0.0, z + 0.03], 0.002);
    h.box([0.05, 0.026, 0.01], STEEL_DARK, [0.01, 0.03, z + 0.038], 0.002);
    // The handle, a squared loop on the right.
    h.box([0.022, 0.014, 0.02], INK, [0.05, 0.06, z], T);
    h.box([0.022, 0.014, 0.02], INK, [0.05, -0.04, z], T);
    h.box([0.014, 0.1, 0.02], INK, [0.062, 0.01, z], T);
    const puffs = [0, 1].map(() => h.box([0.016, 0.016, 0.016], lit(WHITE), [0, 0.16, z], 0.002));
    tick((t) =>
      puffs.forEach((p, i) => {
        const k = (t * 0.5 + i / 2) % 1;
        p.position.set(Math.sin(k * 8 + i * 3) * 0.01, 0.16 + k * 0.1, z);
        p.scale.setScalar(Math.max(0.01, 1 - k * 0.7));
      }),
    );
  },
  // A tea light in a little glass: a clear tumbler, a white wax cup, a wick and a small stepped flame that flickers.
  Fyrfadslys: (h, tick) => {
    const z = 0.06;
    const glass = see("#cfe6f0", 0.38);
    h.box([0.078, 0.01, 0.078], "#9fb8c4", [0, -0.012, z], T);
    h.box([0.08, 0.07, 0.08], glass, [0, 0.024, z], T);
    h.box([0.056, 0.036, 0.056], "#f7f1e0", [0, 0.01, z], T);
    h.box([0.046, 0.006, 0.046], "#fff8dc", [0, 0.03, z], T);
    h.box([0.006, 0.014, 0.006], INK, [0, 0.036, z], 0.001);
    const glow = h.box([0.07, 0.07, 0.07], lit("#ffb94a"), [0, 0.06, z], 0.002);
    (glow.material as THREE.Material).transparent = true;
    (glow.material as THREE.Material).opacity = 0.18;
    const flame = h.part([0, 0.045, z]);
    flame.box([0.02, 0.014, 0.02], lit("#ff9a2e"), [0, 0.007, 0], 0.002);
    flame.box([0.014, 0.022, 0.014], lit("#ffd36a"), [0, 0.022, 0], 0.002);
    flame.box([0.008, 0.016, 0.008], lit("#fff4c4"), [0, 0.036, 0], 0.001);
    // The glass's bright edge.
    h.box([0.008, 0.06, 0.008], "#ffffff", [-0.034, 0.024, z + 0.034], 0.001);
    tick((t) => {
      flame.scale.set(1, 1 + Math.sin(t * 9) * 0.14 + Math.sin(t * 17) * 0.06, 1);
      flame.rotation.z = Math.sin(t * 6) * 0.1;
      glow.scale.setScalar(1 + Math.sin(t * 7) * 0.05);
    });
  },
} satisfies Record<string, HeldBuilder>);
Object.assign(HELD_BUILDERS, HELD);

// MARK: Outfits

/** A band of colour round an arm: a cuff, a mitten. */
const armBand = (c: BodyCtx, color: string, y: number, h: number, pad = 0) =>
  c.arms.forEach((arm) => {
    new Vx(vpart(arm)).b(-1.22 - pad, y, -1.22 - pad, 2.44 + 2 * pad, h, 2.44 + 2 * pad, color);
  });

/** A hem of panels that swing a little when walking: front and back, from the belt. */
function skirt(c: BodyCtx, color: string, trim: string, len: number): void {
  const pivots = [-1, 1].map((side) => {
    const p = vpart(c.body, [0, 0.6 * U, side * 2 * U]);
    const v = new Vx(p);
    for (const s of [-1, 1]) {
      const x = s > 0 ? 0.1 : -4.0;
      const z = side > 0 ? -0.1 : -0.4;
      v.b(x, -len, z, 3.9, len, 0.5, color);
      v.b(x, -len, z - (side > 0 ? -0.0 : 0.05), 3.9, 0.5, 0.55, trim);
    }
    return p;
  });
  c.tick((t, walking) => {
    const a = walking ? 0.1 + Math.abs(Math.sin(t * 11)) * 0.14 : 0.02 + Math.sin(t * 1.5) * 0.015;
    pivots[0]!.rotation.x = a;
    pivots[1]!.rotation.x = -a * 0.6;
  });
}

// biome-ignore format: a catalogue reads best one to a line
const OUTFITS: Record<number, (c: BodyCtx) => void> = {
  // Strikket sæt: a frost-blue knitted jumper with cream cable ribs, a ribbed hem and neck roll, red mittens.
  0: (c) => {
    const v = grid(c);
    // Cable ribs: upright pairs of cream columns down the chest and the back, with a cream yoke row.
    for (const x of [-2.5, -0.5, 1.5]) {
      v.b(x, 0.8, 2.0, 0.55, 5.2, 0.3, CREAM);
      v.b(x + 0.8, 0.8, 2.0, 0.55, 5.2, 0.3, CREAM_DARK);
      v.b(x, 0.8, -2.3, 0.55, 5.2, 0.3, CREAM);
      v.b(x + 0.8, 0.8, -2.3, 0.55, 5.2, 0.3, CREAM_DARK);
    }
    v.b(-3.6, 6.2, 2.0, 7.2, 0.6, 0.3, CREAM);
    v.b(-3.6, 6.2, -2.3, 7.2, 0.6, 0.3, CREAM);
    // The ribbed hem.
    v.b(-3.9, -0.8, -2.3, 7.8, 1.3, 4.6, KNIT_DARK);
    for (let i = 0; i < 8; i++) v.b(-3.9 + i * 0.98, -0.85, -2.33, 0.45, 1.3, 4.66, "#3b5262");
    roll(c, KNIT_DARK, 1.3, 0.45);
    armBand(c, KNIT_DARK, -4.6, 0.7);
    // The mittens: a cream cuff, then red wool over the whole hand with a snowflake dot, and a proper thumb.
    armBand(c, CREAM, -5.9, 0.7, 0.06);
    armBand(c, RED, -8.2, 2.3, 0.18);
    armBand(c, RED_DARK, -8.3, 0.5, 0.2);
    c.arms.forEach((arm, i) => {
      const a = new Vx(vpart(arm));
      a.b(i ? 1.45 : -2.85, -7.7, 0.0, 1.4, 1.5, 1.3, RED);
      a.b(i ? 1.7 : -3.1, -6.6, 0.1, 1.4, 0.5, 1.1, RED_DARK);
      for (const [x, y] of [
        [-0.3, -6.9],
        [0.5, -7.5],
        [-0.3, -8.1],
      ] as const)
        a.b(x, y, 1.45, 0.45, 0.45, 0.25, CREAM);
    });
  },
  // Uldfrakke: a long camel wool coat: wide collar and lapels, dark buttons, a hem that swings, cuffs of dark wool.
  1: (c) => {
    const v = grid(c);
    v.b(-4.0, -0.2, -2.35, 8.0, 7.8, 4.7, CAMEL);
    // The opening, a dark seam down the front, two columns of buttons.
    v.b(-0.2, -0.4, 2.35, 0.4, 7.8, 0.12, CAMEL_DARK);
    for (const y of [1.2, 3.0, 4.8]) {
      v.b(-1.5, y, 2.35, 0.7, 0.7, 0.25, PEBER);
      v.b(0.8, y, 2.35, 0.7, 0.7, 0.25, PEBER);
    }
    // A cream shirt V down the chest, narrowing in steps, framed by two broad stepped lapels that fold out from it.
    for (const [y, hw] of [
      [7.0, 2.6],
      [6.2, 2.0],
      [5.4, 1.5],
      [4.6, 1.0],
      [3.8, 0.5],
    ] as const) {
      v.b(-hw, y, 2.32, hw * 2, 0.8, 0.12, "#e9ddc4");
      v.b(-hw - 1.5, y, 2.3, 1.5, 0.8, 0.5, CAMEL_DARK);
      v.b(hw, y, 2.3, 1.5, 0.8, 0.5, CAMEL_DARK);
      v.b(-hw - 1.5, y, 2.75, 0.3, 0.8, 0.1, CAMEL);
      v.b(hw + 1.2, y, 2.75, 0.3, 0.8, 0.1, CAMEL);
    }
    roll(c, CAMEL_DARK, 1.6, 0.55);
    v.b(-4.0, 0.4, -2.4, 8.0, 0.35, 4.8, CAMEL_DARK);
    // A pocket on each hip.
    for (const x of [-3.2, 1.8]) v.b(x, 0.9, 2.35, 1.4, 1.2, 0.15, CAMEL_DARK);
    skirt(c, CAMEL, CAMEL_DARK, 4.4);
    armBand(c, CAMEL, -5.2, 5.2, 0.05);
    armBand(c, CAMEL_DARK, -6.4, 1.2, 0.1);
  },
  // Gul regnjakke: a glossy yellow raincoat to mid-thigh, a hood hanging at the back, a zip with a storm flap and
  // snap studs, two flapped pockets, grey reflective bands, elastic cuffs and a drawstring at the hem.
  2: (c) => {
    const v = grid(c);
    v.b(-4.0, -0.4, -2.4, 8.0, 8.0, 4.8, RAIN);
    // A loose A-line skirt to the thigh that swings a little.
    skirt(c, RAIN, RAIN_DARK, 3.2);
    // The storm flap down the front, with the zip in the middle and snap studs.
    v.b(-1.3, -0.4, 2.35, 2.6, 7.8, 0.2, RAIN_DARK);
    v.b(-0.18, -0.4, 2.55, 0.36, 7.8, 0.12, INK);
    for (const y of [0.6, 2.0, 3.4, 4.8]) {
      v.b(-1.0, y, 2.55, 0.5, 0.5, 0.2, STEEL);
      v.b(0.5, y, 2.55, 0.5, 0.5, 0.2, STEEL);
    }
    // Flapped pockets.
    for (const x of [-3.4, 1.6]) {
      v.b(x, 1.0, 2.4, 1.8, 1.6, 0.25, RAIN_DARK);
      v.b(x, 2.3, 2.45, 1.8, 0.35, 0.28, RAIN_LIGHT);
    }
    // Grey reflective bands across the chest and the back.
    v.b(-4.05, 3.9, -2.45, 8.1, 0.5, 4.9, "#c9ced6");
    // The standing collar and the hood, down: a pouch at the back with a darker lining.
    roll(c, RAIN_DARK, 1.6, 0.5);
    v.b(-3.2, 4.8, -3.15, 6.4, 3.2, 1.0, RAIN);
    v.b(-2.4, 3.9, -3.15, 4.8, 1.0, 1.0, RAIN);
    v.b(-1.6, 3.2, -3.15, 3.2, 0.8, 1.0, RAIN_DARK);
    v.b(-2.6, 6.8, -3.35, 5.2, 1.0, 0.3, RAIN_DARK);
    v.b(-1.8, 5.8, -3.35, 3.6, 1.0, 0.3, "#9a7410");
    // The hem drawstring ends.
    for (const x of [-0.9, 0.5]) v.b(x, -0.5, 2.55, 0.35, 1.4, 0.2, INK);
    armBand(c, RAIN, -5.4, 5.4, 0.08);
    armBand(c, "#c9ced6", -3.6, 0.45, 0.12);
    armBand(c, INK, -6.6, 1.2, 0.12);
  },
  // Flonelsskjorte: a red and black buffalo-check flannel: big two-colour checks over the chest and back, checked
  // sleeves, a dark collar, a row of buttons, a flapped chest pocket and rolled cuffs.
  3: (c) => {
    const plaid = (g: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a = Math.floor(x / 3) % 2;
          const b = Math.floor(y / 3) % 2;
          px(g, a && b ? INK : a || b ? "#8f1f22" : "#c93a34", x, y);
        }
    };
    marks(c, plaid, plaid);
    const v = grid(c);
    // The rest of the torso, above and below the patch: the same checks as blocks.
    for (const y of [-0.2, 6.3]) {
      const hh = y < 0 ? 1.0 : 1.7;
      for (let i = 0; i < 7; i++) {
        for (const z of [2.0, -2.3]) v.b(-3.5 + i, y, z, 1, hh, 0.3, i % 2 ? "#c93a34" : INK);
      }
    }
    // The hem: a dark band, shirt tails.
    v.b(-3.9, -0.5, -2.3, 7.8, 0.9, 4.6, "#8f1f22");
    roll(c, INK, 1.3, 0.45);
    v.b(-0.9, 5.8, 2.3, 1.8, 0.4, 0.2, INK);
    // The button placket, buttons and a chest pocket on each side.
    v.b(-0.4, 0.2, 2.35, 0.8, 7.6, 0.2, INK);
    for (const y of [0.8, 2.2, 3.6, 5.0]) v.b(-0.2, y, 2.5, 0.4, 0.45, 0.15, CREAM);
    for (const x of [-3.0, 1.2]) {
      v.b(x, 3.4, 2.35, 1.8, 1.6, 0.2, INK);
      v.b(x + 0.2, 3.6, 2.5, 1.4, 0.4, 0.15, "#c93a34");
    }
    // Checked sleeves: bands alternating red and black, with a half-width stripe that makes the check.
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const y = -1.2 - r * 1.0;
      armBand(c, r % 2 ? "#c93a34" : INK, y, 1.0, 0.06);
      c.arms.forEach((arm) => {
        new Vx(vpart(arm)).b(-1.28, y, -1.28, 1.28, 1.0, 2.56, r % 2 ? INK : "#8f1f22");
      });
    }
    armBand(c, RED_DARK, -6.4, 1.2, 0.1);
    armBand(c, INK, -6.45, 0.35, 0.12);
  },
};
for (const [n, build] of Object.entries(OUTFITS)) OUTFIT_BUILDERS[STALL_BASE + Number(n)] = build;

// MARK: Back

const BLANKET = "#b8302c";
const BLANKET_DARK = "#7e1f1d";
const BLANKET_GREEN = "#2f5d3a";

// biome-ignore format: a catalogue reads best one to a line
const BACKS: Record<string, BackBuilder> = {
  // Hyggetæppe: a wide plaid blanket over the shoulders, a deep stepped drape that sways, a cream fringe at the hem.
  Hyggetæppe: (b, tick) => {
    // Seven slabs hung one below the other, each a child of the one above so the hem lags and ripples. Each slab is
    // five plaid columns, red and green, with a cream and a dark pinstripe.
    const steps: ReturnType<typeof vpart>[] = [];
    let at = vpart(b, [0, -0.3 * U, -0.05 * U]);
    for (let i = 0; i < 7; i++) {
      const w = 7 + i * 0.35;
      const cols = [BLANKET, BLANKET_DARK, BLANKET_GREEN, BLANKET_DARK, BLANKET];
      const cw = w / cols.length;
      for (const [k, col] of cols.entries()) {
        const stripe = i % 3 === 1 ? CREAM : i % 3 === 2 ? BLANKET_DARK : col;
        at.box([cw * U, 1.5 * U, 0.8 * U], stripe, [(-w / 2 + cw * (k + 0.5)) * U, -1.5 * U, -0.4 * U]);
        if (i % 3 === 0)
          at.box([cw * 0.3 * U, 1.5 * U, 0.85 * U], CREAM, [
            (-w / 2 + cw * (k + 0.5)) * U,
            -1.5 * U,
            -0.4 * U,
          ]);
      }
      if (i === 6)
        for (let k = 0; k < 16; k++)
          at.box([0.2 * U, 1.0 * U, 0.3 * U], CREAM, [
            (-w / 2 + (k + 0.5) * (w / 16)) * U,
            -2.2 * U,
            -0.4 * U,
          ]);
      steps.push(at);
      at = vpart(at, [0, -1.5 * U, 0]);
    }
    tick((t, walking) =>
      steps.forEach((st, i) => {
        st.rotation.x = walking
          ? 0.05 + Math.abs(Math.sin(t * 11)) * 0.05 + Math.sin(t * 11 - i * 0.8) * 0.025
          : 0.01 + (Math.sin(t * 1.6 - i * 0.6) + 1) * 0.005;
      }),
    );
    const v = new Vx(b);
    // The draped shoulders: a plaid yoke over each shoulder, folded edge, and a wooden toggle at the throat.
    for (const s of [-1, 1]) {
      const x = s > 0 ? 2.6 : -4.6;
      v.b(x, -0.5, -0.9, 2.0, 1.3, 4.9, BLANKET);
      v.b(x, -0.5, -0.9, 2.0, 0.3, 4.9, CREAM);
      v.b(x + (s > 0 ? 0.6 : 0.2), -0.5, -0.9, 0.5, 1.3, 4.9, BLANKET_GREEN);
    }
    v.b(-2.6, -0.2, -1.0, 5.2, 0.8, 0.9, BLANKET_DARK);
    v.b(-0.6, -1.0, 3.7, 1.2, 1.6, 0.5, WOOD);
  },
  // Ski: two skis crossed on the back, tips up beside the head, bindings and a stripe on each.
  Ski: (b, tick) => {
    const skis: ReturnType<typeof vpart>[] = [];
    for (const [i, s] of ([-1, 1] as const).entries()) {
      const p = vpart(b, [0, -3.2 * U, -1.6 * U - i * 0.45 * U]);
      p.rotation.z = s * 0.3;
      const v = new Vx(p);
      const col = i ? "#2c64b8" : RED;
      const dark = i ? "#1d4682" : RED_DARK;
      // The body: a slim slab, a stripe, the tip and tail curving back from the body in steps.
      v.b(-0.7, -8, -0.3, 1.4, 16, 0.5, col);
      v.b(-0.7, -2.4, -0.31, 1.4, 1.4, 0.52, WHITE);
      v.b(-0.7, 7.0, -0.55, 1.4, 1.2, 0.5, col);
      v.b(-0.7, 8.0, -0.85, 1.4, 1.0, 0.5, dark);
      v.b(-0.7, -9.0, -0.5, 1.4, 1.2, 0.5, col);
      // The binding and the toe piece.
      v.b(-0.55, -4.0, -0.7, 1.1, 1.6, 0.5, INK);
      v.b(-0.55, -0.6, -0.7, 1.1, 0.8, 0.5, INK);
      v.b(-0.35, -4.0, -1.0, 0.7, 0.5, 0.4, STEEL);
      skis.push(p);
    }
    tick((t, walking) =>
      skis.forEach((p, i) => {
        p.rotation.x = walking ? Math.sin(t * 11 + i) * 0.03 : 0;
      }),
    );
  },
};
Object.assign(BACK_BUILDERS, BACKS);
