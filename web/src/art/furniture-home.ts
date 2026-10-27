/**
 * Furniture for personal offices (`HOME_PIECES` in core/src/home.ts): plants, a keyboard in a glass case,
 * a whiteboard and the like, drawn in code in the same style as the company's fancy pieces
 * (`furniture-fancy.ts`, which also bakes these: `fancyPiece` looks here too). The ones that hang on the
 * office's top wall are one tile tall (16 px), because an office has only one row of wall face.
 */
import { withAlpha } from "hanzio";
import type { FancyPiece } from "./furniture-fancy.ts";
import { C, shade } from "./palette.ts";
import { glyphPixels, type Pen } from "./pixels.ts";

const K = {
  pot: "#c2703d",
  potLight: "#e08e57",
  potDark: "#9a5530",
  cream: "#efe6d2",
  creamDark: "#cfc3a8",
  pink: "#f28bb2",
  yellow: "#f5d14a",
  orange: "#f08a3c",
  red: "#e8584f",
  green: "#3ddc84",
  blue: "#4f8fe0",
  purple: "#9b6fd6",
  glass: "#a8dcf7",
  glassDark: "#7cc0e6",
  brass: "#e9b73d",
  chrome: "#cfd6df",
  night: "#1b1f2a",
  teak: "#a8683a",
  teakDark: "#7c4a28",
  teakLight: "#c98a55",
} as const;

/** A filled rectangle with a one-pixel ink outline. */
function box(p: Pen, x: number, y: number, w: number, h: number, fill: string): void {
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

const shadow = (p: Pen, x: number, y: number, w: number) => p.rect(x, y, w, 2, C.shadow);

/** A filled ellipse, pixel-exact. */
function oval(p: Pen, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)) + 0.3);
    p.rect(cx - half, cy + y, half * 2 + 1, 1, color);
  }
}

const dots = (p: Pen, pts: readonly (readonly [number, number])[], color: string) => {
  for (const [x, y] of pts) p.px(x, y, color);
};

/** A small rubber duck, `x`/`y` its top-left corner (6 wide, 5 tall). */
function duck(p: Pen, x: number, y: number, pirate = false): void {
  p.rect(x, y + 2, 5, 3, C.ink);
  p.rect(x + 3, y, 3, 3, C.ink);
  p.rect(x + 1, y + 3, 3, 1, K.yellow);
  p.rect(x + 1, y + 2, 2, 1, K.yellow);
  p.rect(x + 4, y + 1, 1, 1, K.yellow);
  p.px(x + 3, y + 3, shade(K.yellow, -0.2));
  p.px(x + 6, y + 2, K.orange);
  p.px(x + 4, y + 1, pirate ? C.ink : K.yellow);
  if (pirate) p.rect(x + 3, y, 2, 1, C.ink);
  else p.px(x + 4, y + 1, C.ink);
}

// MARK: Plants

function cactus(p: Pen): void {
  shadow(p, 3, 18, 10);
  // The arms, then the trunk over them.
  box(p, 3, 7, 5, 3, C.leaf);
  box(p, 3, 4, 3, 6, C.leaf);
  box(p, 8, 6, 5, 3, C.leaf);
  box(p, 10, 3, 3, 6, C.leaf);
  box(p, 6, 2, 4, 11, C.leaf);
  p.rect(8, 3, 1, 9, C.leafDark);
  p.rect(7, 3, 1, 9, C.leafLight);
  dots(
    p,
    [
      [4, 5],
      [4, 8],
      [11, 4],
      [11, 7],
      [9, 6],
    ],
    C.leafLight,
  );
  // A flower on top.
  p.rect(7, 0, 2, 2, K.pink);
  p.px(7, 0, K.red);
  // The pot.
  box(p, 4, 11, 8, 3, K.potLight);
  box(p, 5, 13, 6, 5, K.pot);
  p.rect(6, 14, 1, 3, K.potLight);
  p.rect(9, 14, 1, 3, K.potDark);
}

function fiddleFig(p: Pen): void {
  shadow(p, 3, 30, 10);
  // Trunk and the stalks.
  p.rect(7, 14, 2, 9, C.trunkDark);
  p.px(7, 14, C.trunk);
  dots(
    p,
    [
      [6, 12],
      [5, 11],
      [10, 11],
      [11, 10],
      [8, 9],
      [8, 8],
    ],
    C.trunkDark,
  );
  // Big violin-shaped leaves, glossy and dark.
  const leaf = (cx: number, cy: number, rx: number, ry: number) => {
    oval(p, cx, cy, rx + 1, ry + 1, C.leafInk);
    oval(p, cx, cy, rx, ry, C.leaf);
    oval(p, cx - 1, cy - 1, Math.max(1, rx - 2), Math.max(1, ry - 2), C.leafLight);
    p.rect(cx, cy - ry, 1, ry * 2 + 1, C.leafDark);
  };
  leaf(4, 14, 2, 3);
  leaf(12, 12, 2, 3);
  leaf(5, 7, 3, 3);
  leaf(11, 5, 3, 3);
  leaf(8, 3, 3, 2);
  // A cream ceramic pot.
  box(p, 3, 22, 10, 3, K.cream);
  box(p, 4, 24, 8, 6, K.cream);
  p.rect(5, 25, 1, 4, C.white);
  p.rect(10, 25, 1, 4, K.creamDark);
  p.rect(4, 22, 8, 1, C.white);
}

function hangingPlant(p: Pen): void {
  // The hook and the macrame cords.
  p.rect(7, 2, 2, 1, C.ink);
  p.px(8, 3, C.ink);
  dots(
    p,
    [
      [7, 4],
      [6, 5],
      [9, 4],
      [10, 5],
      [8, 4],
    ],
    K.creamDark,
  );
  // The pot.
  box(p, 4, 6, 8, 4, K.pot);
  p.rect(5, 7, 1, 2, K.potLight);
  p.rect(10, 8, 1, 1, K.potDark);
  // A pothos trailing down both sides.
  for (const [x0, len, dir] of [
    [5, 5, -1],
    [8, 3, 1],
    [11, 4, 1],
  ] as const)
    for (let i = 0; i < len; i++) {
      const x = x0 + (i % 3 === 2 ? dir : 0);
      p.px(x, 10 + i, C.leafDark);
      if (i % 2 === 1) {
        p.rect(x + dir, 10 + i, 2, 2, C.leaf);
        p.px(x + dir, 10 + i, C.leafLight);
      }
    }
  p.rect(3, 8, 2, 2, C.leaf);
  p.rect(12, 8, 2, 2, C.leaf);
  p.px(3, 8, C.leafLight);
  p.px(13, 9, C.leafDark);
}

function bonsaiStand(p: Pen): void {
  shadow(p, 2, 22, 12);
  // A teak stand: top, two legs and a shelf between them.
  box(p, 2, 13, 12, 3, K.teak);
  p.rect(3, 14, 10, 1, K.teakLight);
  p.rect(3, 16, 2, 6, K.teakDark);
  p.rect(11, 16, 2, 6, K.teakDark);
  p.rect(5, 19, 6, 1, K.teakDark);
  // A glazed tray and a twisty trunk with three pads.
  p.rect(4, 11, 8, 3, C.ink);
  p.rect(5, 11, 6, 2, "#3c5a6b");
  p.rect(5, 11, 6, 1, "#5f8196");
  dots(
    p,
    [
      [8, 10],
      [7, 9],
      [7, 8],
      [8, 7],
      [9, 6],
      [6, 7],
      [5, 6],
      [10, 7],
      [11, 7],
    ],
    C.trunkDark,
  );
  for (const [x, y, rx] of [
    [5, 4, 3],
    [11, 5, 3],
    [9, 2, 4],
  ] as const) {
    oval(p, x, y, rx, 1, C.leafInk);
    oval(p, x, y - 1, rx - 1, 1, C.leaf);
    p.px(x - 1, y - 2, C.leafLight);
  }
}

// MARK: Seats, light and floor

function beanBag(p: Pen): void {
  shadow(p, 1, 14, 14);
  oval(p, 8, 9, 7, 5, C.ink);
  oval(p, 8, 9, 6, 4, "#2f8883");
  oval(p, 7, 8, 5, 3, "#3fa6a0");
  oval(p, 9, 7, 3, 1, "#58c1ba");
  // The seam and the dent in the middle.
  p.rect(8, 5, 1, 7, "#2f8883");
  oval(p, 8, 8, 2, 1, "#2f8883");
  dots(
    p,
    [
      [4, 7],
      [5, 6],
    ],
    "#7fd7d0",
  );
  p.px(12, 11, shade("#2f8883", -0.3));
}

function floorLamp(p: Pen): void {
  shadow(p, 4, 30, 8);
  // Base and pole.
  p.rect(4, 28, 8, 2, C.ink);
  p.rect(5, 28, 6, 1, C.metalLight);
  p.rect(7, 11, 2, 17, C.ink);
  p.rect(7, 11, 1, 17, C.metalLight);
  p.px(8, 12, C.metal);
  // The shade: a cone that widens downwards, with a warm light spilling out of its bottom.
  for (let r = 0; r < 9; r++) {
    const w = 6 + r;
    const x = 8 - Math.floor(w / 2);
    p.rect(x - 1, 2 + r, w + 2, 1, C.ink);
    p.rect(x, 2 + r, w, 1, r < 2 ? "#fff3cf" : "#f4e0a8");
    p.px(x, 2 + r, "#fff8e0");
  }
  p.rect(2, 11, 13, 1, C.ink);
  p.rect(3, 11, 11, 1, C.lamp);
  p.rect(5, 12, 7, 1, withAlpha(C.lamp, 0.35));
  p.rect(7, 13, 3, 1, withAlpha(C.lamp, 0.2));
}

function woolRug(p: Pen): void {
  // An oval rug, lying flat: it reaches back over the row behind, like a rug seen from above at an angle.
  oval(p, 16, 15, 15, 8, "#6d4c3d");
  oval(p, 16, 15, 14, 7, "#efe6d2");
  oval(p, 16, 15, 11, 5, "#c4544b");
  oval(p, 16, 15, 9, 4, "#efe6d2");
  oval(p, 16, 15, 6, 3, "#3d4a6b");
  oval(p, 16, 15, 3, 1, "#efe6d2");
  // A few tassels of wool along the rim.
  for (const x of [5, 10, 21, 26]) p.px(x, 21, "#cfc3a8");
  dots(
    p,
    [
      [5, 12],
      [10, 9],
      [24, 10],
      [28, 14],
    ],
    "#fff7e6",
  );
}

// MARK: Things on shelves

function duckShelf(p: Pen): void {
  shadow(p, 1, 26, 14);
  box(p, 1, 1, 14, 26, K.teakDark);
  p.rect(2, 2, 12, 24, "#d9c39a");
  // Three shelves, a duck or two on each.
  for (const y of [9, 17, 25]) {
    p.rect(2, y, 12, 2, K.teak);
    p.rect(2, y, 12, 1, K.teakLight);
  }
  duck(p, 3, 4);
  duck(p, 9, 4);
  duck(p, 6, 12, true);
  duck(p, 2, 20);
  duck(p, 8, 20);
  // The big one on the shelf below: a plain red wellie duck.
  p.rect(11, 19, 2, 1, K.red);
  p.px(2, 2, K.teakLight);
}

function miniFridge(p: Pen): void {
  shadow(p, 2, 18, 12);
  box(p, 2, 1, 12, 18, "#d96a4f");
  p.rect(3, 2, 10, 1, "#f0937a");
  p.rect(3, 8, 10, 1, "#a8493a");
  p.rect(3, 17, 10, 1, "#a8493a");
  // Chrome handles and a Danish flag magnet.
  p.rect(11, 3, 1, 3, K.chrome);
  p.rect(11, 10, 1, 4, K.chrome);
  p.rect(4, 11, 5, 4, K.red);
  p.rect(6, 11, 1, 4, C.white);
  p.rect(4, 12, 5, 1, C.white);
  p.rect(4, 4, 3, 2, K.yellow);
  p.px(5, 5, C.ink);
  p.rect(3, 19, 2, 1, C.ink);
  p.rect(11, 19, 2, 1, C.ink);
}

function bookcase(p: Pen): void {
  shadow(p, 1, 28, 30);
  box(p, 0, 2, 32, 27, K.teakDark);
  p.rect(1, 3, 30, 25, "#3a2a22");
  const spines = ["#c8503c", "#3d6f9e", "#e8c14a", "#58b36a", "#9b6fd6", "#f2f0ea", "#8c5c36", "#e86bd8"];
  [3, 11, 19].forEach((y, row) => {
    let x = 2;
    for (let i = 0; x < 29; i++) {
      const w = 2 + ((i * 7 + row * 3) % 3);
      const h = 4 + ((i * 5 + row) % 4);
      // A gap in the middle shelf, for the plant.
      if (row === 1 && i >= 6 && i < 8) {
        x += 3;
        continue;
      }
      const c = spines[(i * 3 + row * 2) % spines.length]!;
      p.rect(x, y + 8 - h, w, h, c);
      p.rect(x, y + 8 - h, 1, h, shade(c, 0.25));
      p.px(x + w - 1, y + 7, shade(c, -0.3));
      x += w;
    }
    p.rect(1, y + 8, 30, 1, K.teak);
  });
  // A small plant in the middle shelf's gap.
  p.rect(20, 17, 3, 2, K.pot);
  p.rect(19, 14, 5, 3, C.leaf);
  p.px(20, 14, C.leafLight);
  p.rect(0, 2, 32, 1, K.teakLight);
}

// MARK: The keyboard in its case

function keyboardCase(p: Pen, f: number): void {
  shadow(p, 1, 28, 30);
  // A walnut plinth with a brass plaque.
  box(p, 2, 19, 28, 10, K.teakDark);
  p.rect(3, 20, 26, 1, K.teakLight);
  p.rect(11, 24, 10, 3, K.brass);
  p.rect(12, 25, 8, 1, shade(K.brass, -0.35));
  // The glass case over it: a pale box with a bright edge and a glint.
  p.rect(3, 1, 26, 19, C.ink);
  p.rect(4, 2, 24, 17, "#273445");
  p.rect(4, 2, 24, 1, K.glass);
  p.rect(4, 2, 1, 17, K.glass);
  p.rect(27, 2, 1, 17, K.glassDark);
  // The keyboard on an acrylic stand, tilted: dark case, rows of keycaps.
  p.rect(14, 15, 4, 3, K.glassDark);
  p.rect(7, 7, 18, 9, C.ink);
  p.rect(8, 8, 16, 7, "#3c4454");
  const caps = ["#f2f0ea", "#f2f0ea", "#f2f0ea", "#e8584f", "#f2f0ea", "#4f8fe0"];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 7; i++) {
      const accent = row === 0 && (i === 0 || i === 6);
      p.rect(9 + i * 2, 9 + row * 2, 1, 1, accent ? K.orange : caps[(i + row * 2) % caps.length]!);
    }
  p.rect(10, 14, 11, 1, "#f2f0ea");
  // Underglow, a different colour in each frame.
  const glow = f === 0 ? K.pink : K.blue;
  p.rect(8, 15, 16, 1, glow);
  p.rect(6, 16, 20, 1, withAlpha(glow, 0.4));
  // The glint.
  dots(
    p,
    [
      [6, 4],
      [7, 3],
      [8, 5],
    ],
    C.white,
  );
}

// MARK: On the wall (one tile tall)

function certificate(p: Pen): void {
  // The nail, a wooden frame, a creamy paper with lines, and a red seal with ribbons.
  p.px(8, 1, C.ink);
  box(p, 2, 2, 12, 11, K.teak);
  p.rect(3, 3, 10, 1, K.teakLight);
  p.rect(4, 4, 8, 7, "#f6efd9");
  p.rect(5, 5, 6, 1, C.metal);
  p.rect(6, 7, 4, 1, C.metalLight);
  p.rect(5, 8, 3, 1, C.metalLight);
  p.disc(10, 9, 1, K.red);
  p.px(9, 11, K.red);
  p.px(11, 11, K.red);
}

function whiteboard(p: Pen): void {
  // A frame, a diagram (box, arrow, box, arrow, cloud), a graph and ticked-off lines, markers in the tray.
  box(p, 1, 1, 30, 13, C.metalLight);
  p.rect(2, 2, 28, 10, C.white);
  box(p, 4, 3, 6, 4, C.white);
  p.rect(5, 4, 4, 1, K.blue);
  p.rect(10, 5, 3, 1, K.blue);
  p.px(12, 4, K.blue);
  p.px(12, 6, K.blue);
  box(p, 13, 3, 6, 4, C.white);
  p.rect(14, 4, 4, 1, K.purple);
  p.rect(19, 5, 3, 1, K.blue);
  oval(p, 25, 5, 3, 2, K.glass);
  p.rect(23, 5, 5, 1, K.glassDark);
  // A rising line.
  dots(
    p,
    [
      [4, 11],
      [5, 10],
      [6, 10],
      [7, 9],
      [8, 9],
      [9, 8],
      [10, 8],
    ],
    K.red,
  );
  // Ticked-off tasks.
  for (const y of [9, 11]) {
    p.px(14, y, K.green);
    p.rect(16, y, 4 + (y % 3), 1, C.metal);
  }
  p.px(25, 10, K.red);
  p.rect(26, 10, 2, 1, C.metalLight);
  // The tray with a marker or three.
  p.rect(2, 12, 28, 1, C.metal);
  dots(
    p,
    [
      [20, 12],
      [21, 12],
      [23, 12],
      [24, 12],
    ],
    K.blue,
  );
  p.rect(26, 12, 2, 1, K.red);
}

function neonSign(p: Pen, f: number): void {
  const t = K.pink;
  // A dark board with two chains, the letters in pink neon, and a flicker in the last ones.
  box(p, 0, 2, 32, 12, "#2f2838");
  p.rect(1, 3, 30, 1, "#3b3347");
  p.rect(6, 0, 1, 3, C.metal);
  p.rect(25, 0, 1, 3, C.metal);
  const text = "SHIP IT";
  const x0 = Math.floor((32 - (text.length * 4 - 1)) / 2);
  const lit = glyphPixels(text).map(([x, y]): [number, number, boolean] => [x0 + x, 5 + y, x >= 20]);
  const on = (late: boolean) => f === 0 || !late;
  for (const [x, y, late] of lit)
    if (on(late))
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        p.px(x + dx, y + dy, withAlpha(t, 0.3));
  for (const [x, y, late] of lit) p.px(x, y, on(late) ? shade(t, 0.55) : shade(t, -0.45));
}

// MARK: Night Market (the case's furniture, `core/src/case-furniture.ts`)

const N = {
  red: "#d8402f",
  redDark: "#a42a22",
  redLight: "#f06a4a",
  lacquer: "#23202b",
  paper: "#fff1c9",
  gold: "#e9b73d",
  glow: "#ffd36a",
  pink: "#ff5fa2",
  teal: "#2f7f9a",
  tealDark: "#1f5470",
  tealLight: "#5cb7c9",
  navy: "#2b3358",
} as const;

/** A paper lantern: `cx` its centre column, `top` its cap row; 7 wide, 8 tall with the tassel. */
function paperLantern(p: Pen, cx: number, top: number, color: string, lit: boolean): void {
  p.rect(cx - 1, top, 3, 1, C.ink);
  p.rect(cx - 3, top + 1, 7, 6, C.ink);
  p.rect(cx - 2, top + 1, 5, 5, color);
  p.rect(cx - 1, top + 2, 3, 3, lit ? N.glow : shade(color, 0.3));
  p.rect(cx - 2, top + 1, 5, 1, N.gold);
  p.rect(cx - 2, top + 5, 5, 1, N.gold);
  p.px(cx - 1, top + 2, N.paper);
  p.rect(cx, top + 7, 1, 2, N.gold);
}

function nightLanterns(p: Pen, frame: number): void {
  const sag = (x: number) => Math.round(2 * Math.sin((x / 31) * Math.PI));
  for (let x = 1; x <= 30; x++) p.px(x, 1 + sag(x), C.ink);
  p.rect(0, 0, 2, 3, K.brass);
  p.rect(30, 0, 2, 3, K.brass);
  p.px(0, 0, C.ink);
  p.px(31, 0, C.ink);
  [
    [5, N.red],
    [11, K.orange],
    [16, N.pink],
    [21, K.orange],
    [27, N.red],
  ].forEach(([x, c], i) => {
    const cx = x as number;
    paperLantern(p, cx, 2 + sag(cx), c as string, (i + frame) % 2 === 0);
  });
}

function nightKoiRug(p: Pen): void {
  oval(p, 16, 15, 15, 8, N.lacquer);
  oval(p, 16, 15, 14, 7, N.red);
  oval(p, 16, 15, 13, 6, N.paper);
  oval(p, 16, 15, 12, 5, N.tealDark);
  oval(p, 16, 15, 10, 4, N.teal);
  // Ripples and two lily pads.
  dots(
    p,
    [
      [9, 14],
      [10, 15],
      [23, 13],
      [22, 12],
      [16, 16],
    ],
    N.tealLight,
  );
  p.disc(8, 17, 1, K.green);
  p.px(8, 16, K.pink);
  p.disc(24, 18, 1, K.green);
  // An orange koi swimming right, a white one with red patches swimming left.
  const koi = (x: number, y: number, dir: 1 | -1, body: string, patch: string) => {
    const fin = shade(body, -0.25);
    p.rect(x, y, 7, 3, body);
    p.rect(x + (dir === 1 ? 1 : 3), y, 3, 1, patch);
    p.rect(x + (dir === 1 ? 4 : 1), y + 2, 2, 1, patch);
    p.rect(x + (dir === 1 ? 0 : 6), y + 1, 1, 1, fin);
    p.px(x + (dir === 1 ? 6 : 0), y + 1, C.ink);
    const tx = dir === 1 ? x - 3 : x + 7;
    p.rect(tx, y + 1, 3, 1, fin);
    p.px(tx + (dir === 1 ? 0 : 2), y, fin);
    p.px(tx + (dir === 1 ? 0 : 2), y + 2, fin);
    p.px(x + 3, y + 3, fin);
  };
  koi(14, 11, 1, K.orange, N.red);
  koi(15, 17, -1, "#f6f1e8", K.orange);
  p.rect(28, 20, 1, 1, N.gold);
  p.rect(3, 20, 1, 1, N.gold);
}

function nightTeaStool(p: Pen, frame: number): void {
  shadow(p, 2, 16, 12);
  // Three legs, a cross brace, a round red cushion on a wooden seat.
  p.rect(3, 9, 2, 7, C.ink);
  p.rect(11, 9, 2, 7, C.ink);
  p.rect(7, 9, 2, 7, C.ink);
  p.rect(3, 9, 1, 7, K.teakLight);
  p.rect(11, 9, 1, 7, K.teakLight);
  p.rect(7, 9, 1, 7, K.teakLight);
  p.rect(4, 13, 8, 1, K.teakDark);
  p.rect(2, 7, 12, 3, C.ink);
  p.rect(3, 7, 10, 2, K.teak);
  p.rect(3, 6, 10, 1, N.redDark);
  p.rect(4, 6, 8, 1, N.red);
  // A cup of tea with steam.
  p.rect(5, 3, 6, 4, C.ink);
  p.rect(6, 3, 4, 3, K.cream);
  p.rect(6, 3, 4, 1, N.tealLight);
  p.rect(11, 4, 2, 2, C.ink);
  p.px(12, 4, K.cream);
  const dx = frame;
  p.px(7 + dx, 1, K.chrome);
  p.px(8 - dx, 0, K.chrome);
  p.px(9 + dx, 2, K.chrome);
}

function nightRamenCounter(p: Pen, frame: number): void {
  shadow(p, 1, 26, 30);
  // The awning with its bulbs, and the noren curtain hanging from it.
  box(p, 0, 0, 32, 5, N.red);
  p.rect(1, 1, 30, 1, N.redLight);
  for (let x = 3; x < 30; x += 5) p.px(x, 3, frame ? N.glow : K.brass);
  for (const x of [3, 12, 21]) {
    p.rect(x, 5, 8, 8, C.ink);
    p.rect(x + 1, 5, 6, 7, N.navy);
    p.rect(x + 3, 6, 2, 5, K.cream);
    p.rect(x + 2, 8, 4, 1, K.cream);
  }
  p.rect(11, 5, 1, 7, C.ink);
  p.rect(20, 5, 1, 7, C.ink);
  // The counter: a plank top, a dark front with a red stripe, a shelf of two bowls.
  box(p, 0, 14, 32, 3, K.teakLight);
  box(p, 1, 17, 30, 9, K.teakDark);
  p.rect(2, 20, 28, 2, N.red);
  p.rect(2, 21, 28, 1, N.redDark);
  for (const x of [8, 15, 22]) p.rect(x, 18, 1, 8, C.ink);
  const bowl = (x: number) => {
    p.rect(x, 11, 7, 4, C.ink);
    p.rect(x + 1, 11, 5, 3, K.cream);
    p.rect(x + 1, 11, 5, 1, K.yellow);
    p.px(x + 2, 11, N.red);
    p.px(x + 4, 11, K.green);
    p.rect(x + 2, 14, 3, 1, N.red);
  };
  bowl(5);
  bowl(20);
  p.px(8 + frame, 9, K.chrome);
  p.px(9 - frame, 8, K.chrome);
  p.px(23 + frame, 9, K.chrome);
  p.px(24 - frame, 8, K.chrome);
  p.rect(13, 12, 1, 3, K.brass);
  p.rect(15, 12, 1, 3, K.brass);
}

function nightClawMachine(p: Pen, frame: number): void {
  shadow(p, 1, 30, 14);
  // The cabinet and its marquee, whose bulbs chase.
  box(p, 1, 0, 14, 30, N.navy);
  box(p, 1, 0, 14, 5, N.pink);
  for (let x = 3; x < 14; x += 2) p.px(x, 2, (x / 2 + frame) % 2 ? N.glow : K.cream);
  // The glass box: plush toys piled at the bottom, the claw hanging from its rail.
  box(p, 2, 6, 12, 14, K.glass);
  p.rect(3, 7, 10, 12, K.glassDark);
  p.rect(3, 7, 2, 12, K.glass);
  p.rect(5, 7, 8, 1, C.ink);
  const cx = 8 + frame;
  p.rect(cx, 8, 1, 3, K.chrome);
  p.rect(cx - 1, 11, 3, 1, K.brass);
  p.px(cx - 1, 12, K.brass);
  p.px(cx + 1, 12, K.brass);
  p.rect(3, 15, 10, 4, K.pink);
  p.rect(3, 16, 4, 3, K.yellow);
  p.rect(8, 14, 4, 5, K.green);
  p.disc(5, 15, 1, K.cream);
  p.disc(10, 14, 1, K.cream);
  dots(p, [[5, 16], [10, 15], [9, 17]], C.ink);
  // The control panel: a joystick, two buttons and a coin slot; the chute below.
  p.rect(2, 21, 12, 4, N.lacquer);
  p.rect(4, 21, 1, 2, K.chrome);
  p.disc(4, 21, 1, N.red);
  p.disc(8, 23, 1, K.yellow);
  p.disc(11, 23, 1, K.blue);
  p.rect(12, 21, 1, 1, K.brass);
  box(p, 3, 26, 10, 4, C.ink);
  p.rect(4, 27, 8, 2, N.lacquer);
}

function nightTorii(p: Pen, frame: number): void {
  // A pool of lantern light on the ground between the pillars.
  oval(p, 24, 41, 18, 3, "rgba(255, 211, 106, 0.25)");
  shadow(p, 4, 42, 40);
  // The two pillars, each on a black stone base with a gold ring, shaded left to right.
  for (const x of [8, 35]) {
    p.rect(x - 1, 14, 7, 28, C.ink);
    p.rect(x, 14, 5, 27, N.red);
    p.rect(x, 14, 1, 27, N.redLight);
    p.rect(x + 4, 14, 1, 27, N.redDark);
    p.rect(x - 2, 38, 9, 5, C.ink);
    p.rect(x - 1, 39, 7, 3, N.lacquer);
    p.rect(x - 1, 39, 7, 1, "#3a3646");
    p.rect(x, 20, 5, 1, N.gold);
  }
  // The lower tie beam, the plaque between, and the upper beams: the kasagi curls up at both ends.
  box(p, 4, 15, 40, 4, N.red);
  p.rect(5, 16, 38, 1, N.redLight);
  box(p, 20, 7, 8, 9, N.lacquer);
  p.rect(21, 8, 6, 7, N.gold);
  p.rect(22, 9, 4, 1, N.lacquer);
  p.rect(23, 9, 2, 5, N.lacquer);
  p.rect(22, 11, 4, 1, N.lacquer);
  p.rect(22, 13, 1, 1, N.lacquer);
  p.rect(25, 13, 1, 1, N.lacquer);
  p.rect(5, 7, 38, 3, C.ink);
  p.rect(6, 7, 36, 2, N.red);
  p.rect(6, 7, 36, 1, N.redLight);
  box(p, 0, 3, 48, 4, N.lacquer);
  p.rect(2, 4, 44, 1, "#3a3646");
  p.rect(0, 1, 4, 3, N.lacquer);
  p.rect(44, 1, 4, 3, N.lacquer);
  p.px(0, 0, N.lacquer);
  p.px(47, 0, N.lacquer);
  p.rect(1, 2, 1, 1, "#3a3646");
  // Four lanterns hang from the tie beam; a lit pair flickers in turn.
  paperLantern(p, 14, 19, N.red, frame === 0);
  paperLantern(p, 33, 19, N.red, frame === 0);
  paperLantern(p, 3, 4, N.pink, frame === 1);
  paperLantern(p, 44, 4, N.pink, frame === 1);
}

// MARK: Catalog

const piece = (
  id: string,
  name: string,
  w: number,
  height: number,
  price: number,
  draw: FancyPiece["draw"],
  extra: Partial<Pick<FancyPiece, "frames" | "frameMs" | "placement" | "rarity">> = {},
): FancyPiece => ({
  id,
  name,
  w,
  h: 1,
  height,
  price,
  rarity: price >= 200 ? "rare" : price >= 100 ? "uncommon" : "common",
  frames: 1,
  frameMs: 500,
  tint: null,
  placement: "floor",
  draw,
  ...extra,
});

export const HOME_FURNITURE: readonly FancyPiece[] = [
  piece("cactus", "Cactus", 1, 20, 40, cactus),
  piece("certificate", "Framed certificate", 1, 16, 45, certificate, { placement: "wall" }),
  piece("bean-bag", "Bean bag", 1, 16, 60, beanBag),
  piece("hanging-plant", "Hanging plant", 1, 16, 70, hangingPlant, { placement: "wall" }),
  piece("wool-rug", "Wool rug", 2, 24, 70, woolRug, { placement: "flat" }),
  piece("floor-lamp", "Floor lamp", 1, 32, 80, floorLamp),
  piece("fiddle-fig", "Fiddle-leaf fig", 1, 32, 90, fiddleFig),
  piece("duck-shelf", "Rubber-duck shelf", 1, 28, 100, duckShelf),
  piece("wall-whiteboard", "Office whiteboard", 2, 16, 110, whiteboard, { placement: "wall" }),
  piece("home-fridge", "Mini fridge", 1, 20, 120, miniFridge),
  piece("bonsai-stand", "Bonsai on a stand", 1, 24, 130, bonsaiStand),
  piece("bookcase", "Bookcase", 2, 30, 150, bookcase),
  piece("wall-neon", "Pink neon sign", 2, 16, 200, neonSign, { frames: 2, frameMs: 700, placement: "wall" }),
  piece("keyboard-case", "Mechanical keyboard display", 2, 30, 260, keyboardCase, {
    frames: 2,
    frameMs: 900,
  }),
];

/** The Night Market case's pieces (`CASE_PIECES` in core/src/case-furniture.ts). */
export const CASE_FURNITURE: readonly FancyPiece[] = [
  piece("night-lanterns", "Lantern string", 2, 16, 0, nightLanterns, { frames: 2, frameMs: 600, placement: "wall", rarity: "common" }),
  piece("night-koi-rug", "Koi rug", 2, 24, 0, nightKoiRug, { placement: "flat", rarity: "common" }),
  piece("night-tea-stool", "Tea stool", 1, 18, 0, nightTeaStool, { frames: 2, frameMs: 500, rarity: "common" }),
  piece("night-ramen-counter", "Ramen counter", 2, 28, 0, nightRamenCounter, { frames: 2, frameMs: 500, rarity: "uncommon" }),
  piece("night-claw-machine", "Arcade claw machine", 1, 32, 0, nightClawMachine, { frames: 2, frameMs: 500, rarity: "uncommon" }),
  piece("night-torii", "Torii gate", 3, 44, 0, nightTorii, { frames: 2, frameMs: 650, rarity: "rare" }),
];
