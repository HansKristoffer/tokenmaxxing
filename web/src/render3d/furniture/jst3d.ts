/**
 * Julepynt's five pieces in 3D (`JULEPYNT_PIECES` in core/src/julemarked-shop.ts), the same ones
 * `julemarked-stall-furniture.ts` draws in 2D: an advent star lamp, an advent calendar, a nisse door, a tabletop
 * tree and a stack of presents. Everything is a box or a stepped stack of boxes (no spheres, cylinders or discs), so
 * smooth and voxel styles read the same. Built like `jul3d.ts`: bottom centre at the origin, front along +z. The
 * three wall pieces hang (`room.hang(model, x, 0.95)`), so they build on y = 0 facing +z, and the door, which
 * stands on the floor, reaches down to y = -0.95. Brief: docs/cases/julemarked.md.
 */
import { glow, Model, type Paint } from "../kit/kit.ts";
import { light } from "./furniture.ts";
import { JUL_CREAM, JUL_GOLD, JUL_GREEN, JUL_RED } from "./jul3d.ts";

const WOOD = "#a06a3c";
const WOOD_D = "#6e4526";
const WOOD_L = "#c08a52";
const DARK = "#2a1a12";
const GREEN_L = "#4a8a52";
const BEV = 0.004;
/** How far a hung piece's lowest point is below its y = 0 (the room hangs it at 0.95). */
const HUNG = 0.95;

/** A flat bar `len` long and `w` thick, turned `a` about z, centred on (x, y) at depth z. */
function bar(
  m: Model,
  x: number,
  y: number,
  z: number,
  len: number,
  w: number,
  d: number,
  a: number,
  col: string,
): void {
  const p = m.part([x, y, z]);
  p.rotation.z = a;
  p.box([len, w, d], col, [0, -w / 2, 0], BEV);
}

/** An eight-pointed star from four crossed bars (the diagonals a little shorter) and a hub, facing +z. */
function star8(m: Model, x: number, y: number, z: number, s: number, col: string, core: Paint): void {
  const w = s * 0.2;
  const d = s * 0.14;
  for (let i = 0; i < 4; i++)
    bar(m, x, y, z - (i % 2) * 0.004, s * (i % 2 ? 0.78 : 1), w, d, (i * Math.PI) / 4, col);
  m.box([s * 0.26, s * 0.26, d * 1.3], core, [x - s * 0.13, y - s * 0.13, z], BEV);
}

// MARK: Adventsstjerne

const adventStar = (): Model => {
  const m = new Model();
  const cy = 0.5;
  // A cord and a wall hook, then the paper star in two layers (warm gold behind, cream in front), lit from inside.
  m.box([0.14, 0.05, 0.05], WOOD_D, [0, cy + 0.5, 0.02], BEV);
  m.box([0.02, 0.1, 0.02], "#d8c9a6", [0, cy + 0.42, 0.04], BEV);
  star8(m, 0, cy, 0.1, 1.08, "#f6c46a", "#f6c46a");
  star8(m, 0, cy, 0.14, 0.9, JUL_CREAM, glow("#fff1b8"));
  m.box([0.1, 0.1, 0.05], glow(JUL_GOLD), [-0.05, cy - 0.05, 0.22], BEV);
  light(m, [0, cy, 0.5], "#ffcf7a", 1.1, 4);
  return m;
};

// MARK: Julekalender

const adventCalendar = (): Model => {
  const root = new Model();
  const m = root.part([0, 0, 0.04]);
  const W = 0.96;
  const H = 1.14;
  // A wooden frame with a cream backing, a little red roof and a hanging loop.
  m.box([W, H, 0.05], WOOD_D, [0, 0, 0.02], 0.006);
  m.box([W - 0.1, H - 0.1, 0.03], JUL_CREAM, [0, 0.05, 0.07], BEV);
  m.box([W + 0.1, 0.07, 0.1], JUL_RED, [0, H, 0.02], 0.006);
  m.box([W + 0.02, 0.05, 0.12], "#8c211f", [0, H + 0.07, 0.02], 0.004);
  m.box([0.1, 0.06, 0.1], JUL_GOLD, [-0.05, H + 0.12, 0.02], BEV);
  // 24 doors, 4 across by 6 up, in red, green and cream with a gold knob; a few stand open on their hinges.
  const open = new Set([0, 1, 2, 5, 6, 9, 13, 17]);
  const cw = 0.18;
  const ch = 0.14;
  const gx = 0.215;
  const gy = 0.172;
  const cols = [JUL_RED, JUL_GREEN, "#e8dcc0", "#b8302c"];
  for (let i = 0; i < 24; i++) {
    const c = i % 4;
    const r = 5 - Math.floor(i / 4);
    const x = (c - 1.5) * gx;
    const y = 0.1 + r * gy;
    if (open.has(i)) {
      // The recess, a prize in it, and the door swung out to one side.
      m.box([cw, ch, 0.03], DARK, [x, y, 0.09], BEV);
      m.box([0.06, 0.06, 0.03], i % 2 ? glow(JUL_GOLD) : JUL_RED, [x, y + 0.03, 0.115], BEV);
      const hinge = m.part([x - cw / 2, 0, 0.12]);
      hinge.rotation.y = -1.1;
      hinge.box([cw * 0.9, ch, 0.02], cols[(i + 1) % 3]!, [cw * 0.45, y, 0], BEV);
    } else {
      m.box([cw, ch, 0.04], cols[i % 3]!, [x, y, 0.1], BEV);
      m.box([cw - 0.05, 0.02, 0.01], "#fff3dc", [x, y + ch * 0.62, 0.14], 0.001);
      m.box([0.03, 0.03, 0.02], JUL_GOLD, [x + cw * 0.32, y + ch * 0.4, 0.14], 0.002);
    }
  }
  return root;
};

// MARK: Nissedør

const nisseDoor = (): Model => {
  const m = new Model();
  const y0 = -HUNG;
  // The step, then the door's frame, planks, a curtained window and a knob; a roof lip on top.
  m.box([0.7, 0.07, 0.3], "#8a8f98", [0, y0, 0.15], 0.006);
  m.box([0.56, 0.06, 0.2], "#a4a9b2", [0, y0 + 0.07, 0.14], 0.006);
  m.box([0.62, 0.85, 0.07], WOOD_D, [0, y0 + 0.07, 0.035], 0.006);
  m.box([0.52, 0.78, 0.05], WOOD, [0, y0 + 0.07, 0.075], BEV);
  for (const x of [-0.17, 0, 0.17]) m.box([0.012, 0.78, 0.02], WOOD_D, [x, y0 + 0.07, 0.108], 0.001);
  m.box([0.62, 0.06, 0.1], JUL_RED, [0, y0 + 0.92, 0.04], 0.006);
  m.box([0.68, 0.05, 0.12], "#8c211f", [0, y0 + 0.98, 0.06], 0.004);
  // Window: frame, glow behind, and a red-white check curtain pulled to both sides.
  const wy = y0 + 0.46;
  m.box([0.3, 0.3, 0.03], WOOD_L, [0, wy, 0.1], BEV);
  m.box([0.24, 0.24, 0.03], glow("#ffd98a"), [0, wy + 0.03, 0.115], 0.002);
  for (let r = 0; r < 4; r++)
    for (const s of [-1, 1])
      for (let c = 0; c < 2; c++) {
        const on = (r + c) % 2 === 0;
        m.box(
          [0.055, 0.06, 0.02],
          on ? JUL_RED : "#ffffff",
          [s * (0.1 - c * 0.055), wy + 0.03 + r * 0.06, 0.14],
          0.001,
        );
      }
  m.box([0.34, 0.025, 0.04], WOOD_D, [0, wy - 0.025, 0.13], 0.002);
  m.box([0.34, 0.03, 0.03], WOOD_D, [0, wy + 0.3, 0.12], 0.002);
  // Brass knob and a tiny brass number plate; a green wreath sprig on the lintel.
  m.box([0.045, 0.045, 0.04], JUL_GOLD, [0.19, y0 + 0.4, 0.13], 0.004);
  m.box([0.14, 0.05, 0.02], JUL_GOLD, [0, y0 + 0.78, 0.115], 0.003);
  m.box([0.1, 0.05, 0.03], JUL_GREEN, [-0.06, y0 + 0.86, 0.12], 0.003);
  m.box([0.03, 0.03, 0.03], JUL_RED, [0.0, y0 + 0.88, 0.14], 0.002);
  light(m, [0, y0 + 0.5, 0.45], "#ffcf7a", 0.5, 2.5);
  return m;
};

// MARK: Bordjuletræ

/** A blocky paper heart facing +z, `u` per cell: three rows of cells, woven in two tones. */
function blockHeart(m: Model, x: number, y: number, z: number, u: number, a: string, b: string): void {
  // Row by row from the top: two lobes, a wide middle, then the point.
  const rows: [number[], string][] = [
    [[-1, 1], a],
    [[-1, 0, 1], b],
    [[0], a],
  ];
  rows.forEach(([xs, col], i) => {
    for (const cx of xs)
      m.box([u, u, 0.02], i === 1 && cx === 0 ? a : col, [x + cx * u, y + (2 - i) * u - u / 2, z], 0.001);
  });
}

const bordTree = (): Model => {
  const m = new Model();
  // A little wooden crate for a pot, with snow on its rim.
  m.box([0.34, 0.14, 0.34], WOOD, [0, 0, 0], 0.006);
  m.box([0.36, 0.03, 0.36], WOOD_D, [0, 0.14, 0], 0.004);
  m.box([0.1, 0.05, 0.1], WOOD_D, [0, 0.17, 0], BEV);
  // Five stepped tiers of boughs, narrowing upward, in two greens.
  const tiers: [number, number, number][] = [
    [0.7, 0.14, 0.2],
    [0.58, 0.14, 0.32],
    [0.46, 0.13, 0.44],
    [0.34, 0.12, 0.55],
    [0.22, 0.11, 0.65],
  ];
  tiers.forEach(([w, h, y], i) => {
    m.box([w, h, w], i % 2 ? GREEN_L : JUL_GREEN, [0, y, 0], 0.008);
    m.box([w + 0.02, 0.02, w + 0.02], "#1f4a2c", [0, y, 0], 0.003);
  });
  // A gold star on top: a small plus with diagonal arms.
  star8(m, 0, 0.84, 0, 0.2, JUL_GOLD, glow("#fff1b8"));
  // Woven hearts hung on the front, red and white, and a string of warm lights.
  blockHeart(m, -0.15, 0.3, 0.3, 0.05, JUL_RED, "#ffffff");
  blockHeart(m, 0.14, 0.44, 0.24, 0.045, "#ffffff", JUL_RED);
  blockHeart(m, -0.07, 0.56, 0.2, 0.04, JUL_RED, "#ffffff");
  blockHeart(m, 0.09, 0.21, 0.36, 0.045, "#ffffff", JUL_RED);
  [
    [-0.28, 0.27, 0.34],
    [0.24, 0.31, 0.3],
    [-0.2, 0.43, 0.24],
    [0.17, 0.55, 0.2],
    [-0.1, 0.65, 0.13],
    [0.08, 0.7, 0.1],
  ].forEach(([x, y, z]) => {
    m.box([0.034, 0.034, 0.034], glow(JUL_GOLD), [x! - 0.017, y!, z!], 0.003);
  });
  light(m, [0, 0.55, 0.35], "#ffcf7a", 0.7, 3);
  return m;
};

// MARK: Gavestabel

/** A wrapped present: paper, two ribbon bands, a flat lid and a blocky bow. */
function present(
  m: Model,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  paper: string,
  ribbon: string,
  turn: number,
): void {
  const g = m.part([x, y, z], turn);
  g.box([w, h, d], paper, [0, 0, 0], 0.008);
  g.box([w + 0.012, h * 0.2, d + 0.012], paper, [0, h * 0.78, 0], 0.004);
  g.box([w + 0.016, h + 0.004, 0.05], ribbon, [0, 0, 0], 0.002);
  g.box([0.05, h + 0.004, d + 0.016], ribbon, [0, 0, 0], 0.002);
  // Bow: two angled loops and a knot.
  for (const s of [-1, 1]) {
    const loop = g.part([s * 0.04, h + 0.01, 0]);
    loop.rotation.z = -s * 0.5;
    loop.box([0.07, 0.045, 0.04], ribbon, [-0.035 + (s > 0 ? 0.07 : 0) * 0, 0, 0], 0.003);
  }
  g.box([0.045, 0.05, 0.045], ribbon, [0, h + 0.005, 0], 0.003);
}

const presentStack = (): Model => {
  const m = new Model();
  present(m, -0.02, 0, 0.0, 0.5, 0.3, 0.46, JUL_RED, JUL_CREAM, 0.12);
  present(m, 0.03, 0.3, 0.0, 0.34, 0.24, 0.32, JUL_GREEN, JUL_GOLD, -0.2);
  present(m, 0.0, 0.54, 0.0, 0.2, 0.18, 0.2, JUL_CREAM, JUL_RED, 0.35);
  present(m, 0.33, 0, 0.18, 0.24, 0.2, 0.24, "#e8dcc0", JUL_GREEN, -0.25);
  present(m, -0.34, 0, 0.2, 0.2, 0.16, 0.2, JUL_GREEN, JUL_CREAM, 0.3);
  // A gift tag hanging off the big box.
  m.box([0.07, 0.09, 0.012], "#fff3dc", [-0.12, 0.12, 0.25], 0.001);
  m.box([0.012, 0.03, 0.012], JUL_RED, [-0.12, 0.2, 0.25], 0.001);
  return m;
};

export const JST_ASSETS: readonly {
  id: string;
  name: string;
  w: number;
  d: number;
  wall: boolean;
  build: () => Model;
}[] = [
  { id: "jst-star", name: "Adventsstjerne", w: 1, d: 1, wall: true, build: adventStar },
  { id: "jst-kalender", name: "Julekalender", w: 1, d: 1, wall: true, build: adventCalendar },
  { id: "jst-nissedoer", name: "Nissedør", w: 1, d: 1, wall: true, build: nisseDoor },
  { id: "jst-bordtree", name: "Bordjuletræ", w: 1, d: 1, wall: false, build: bordTree },
  { id: "jst-gaver", name: "Gavestabel", w: 1, d: 1, wall: false, build: presentStack },
];
