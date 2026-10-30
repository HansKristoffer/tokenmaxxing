import { CANDLE_SLOTS, MEMORIAL_PLAQUE } from "@tokenmaxxing/core/befrielsen.ts";
import type { Facing, Look } from "@tokenmaxxing/core/world.ts";
import { FLAT_CAP } from "./befrielsen-hats.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/**
 * Befrielsen in 2D (`game/befrielsen.ts`, `core/src/befrielsen.ts`): the memorial with its candle tray, the
 * Dannebrog on its pole, a candle in a window, Henning the storyteller, and the two hats. Quiet colours: granite,
 * wool, candle cream and one small flame of yellow.
 */

const o = C.ink;
const GRANITE = "#8d8f98";
const GRANITE_LIGHT = "#b3b5bd";
const GRANITE_DARK = "#6a6c76";
const CREAM = "#f4efe4";
const FLAME = "#ffd45a";
const FLAME_TIP = "#fff3b0";
const RED = "#c8102e";
const WHITE = "#fbf7ef";

// MARK: The memorial

/** The memorial's sprite: three tiles wide, and its bottom edge is the bottom of its second tile row. */
export const MEMORIAL_PX = { w: 48, h: 46 } as const;

/** Where candle `i`'s foot is on the sprite (the tray's two rows of seven), for the flame and its glow. */
export const candleAt = (i: number): [number, number] => [10 + (i % 7) * 5, i < 7 ? 38 : 42];

function flag(p: Pen, x: number, y: number): void {
  p.rect(x, y, 7, 5, RED);
  p.rect(x + 2, y, 1, 5, WHITE);
  p.rect(x, y + 2, 7, 1, WHITE);
}

/** The memorial with `lit` of its 14 candles burning: the town's from the left, then yours from the right. */
export const memorialSprite = cached(
  (town: number, mine: number) => `${town}.${mine}`,
  (town: number, mine: number) =>
    bake(MEMORIAL_PX.w, MEMORIAL_PX.h, (p) => {
      // The low wall, with a plaque to each side of the stele.
      p.rect(3, 19, 42, 12, o);
      p.rect(4, 20, 40, 10, GRANITE);
      p.rect(4, 20, 40, 1, GRANITE_LIGHT);
      p.rect(4, 29, 40, 1, GRANITE_DARK);
      for (const x of [3, 31]) {
        p.rect(x + 1, 21, 15, 7, "#3d3f4a");
      }
      p.text(MEMORIAL_PLAQUE.slice(0, 4), 4, 22, "#e6e0d0");
      p.text(MEMORIAL_PLAQUE.slice(5, 9), 32, 22, "#e6e0d0");
      // The stele, taller, with a wreath of green and a ribbon in the national colours.
      p.rect(17, 0, 14, 24, o);
      p.rect(18, 1, 12, 22, GRANITE);
      p.rect(18, 1, 2, 22, GRANITE_LIGHT);
      p.rect(28, 1, 2, 22, GRANITE_DARK);
      p.rect(18, 1, 12, 1, GRANITE_LIGHT);
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        const x = Math.round(24 + Math.cos(t) * 4.6);
        const y = Math.round(9 + Math.sin(t) * 4.6);
        p.rect(x - 1, y - 1, 2, 2, a % 3 === 0 ? C.leaf : a % 3 === 1 ? C.leafDark : C.leafLight);
      }
      p.px(24, 4, WHITE);
      p.px(21, 14, RED);
      p.px(27, 14, WHITE);
      p.rect(23, 14, 2, 3, RED);
      p.rect(22, 16, 4, 1, WHITE);
      // Two small flags at the wall's ends.
      p.rect(4, 11, 1, 9, WHITE);
      flag(p, 5, 11);
      p.rect(43, 11, 1, 9, WHITE);
      flag(p, 36, 11);
      // The candle tray: a slab of stone, two rows of candles.
      p.rect(6, 33, 37, 12, o);
      p.rect(7, 34, 35, 10, "#a39f98");
      p.rect(7, 34, 35, 1, "#c9c4bb");
      p.rect(7, 43, 35, 1, "#7e7a73");
      for (let i = 0; i < CANDLE_SLOTS; i++) {
        const [x, y] = candleAt(i);
        const burning = i < town || i >= CANDLE_SLOTS - mine;
        p.rect(x, y - 3, 2, 3, CREAM);
        p.px(x + 1, y - 3, "#d7d0be");
        if (burning) {
          p.px(x, y - 5, FLAME);
          p.px(x, y - 4, FLAME);
          p.px(x, y - 6, FLAME_TIP);
        }
      }
      // A few white and red flowers laid at the foot.
      for (const [x, y, c] of [
        [2, 31, WHITE],
        [4, 32, RED],
        [44, 31, WHITE],
        [45, 32, RED],
        [10, 31, RED],
        [38, 31, WHITE],
      ] as const)
        p.px(x, y, c);
    }),
);

// MARK: The flag on its pole

/** The Dannebrog on a pole: 16 wide and 40 tall, the pole at x = 3 with its foot on the bottom row. */
export const FLAG_PX = { w: 16, h: 40 } as const;

export const flagpoleSprite = cached(
  (frame: number) => String(frame),
  (frame: number) =>
    bake(FLAG_PX.w, FLAG_PX.h, (p) => {
      p.rect(2, 36, 4, 2, "rgba(20,16,28,0.25)");
      p.rect(3, 3, 1, 36, "#ece8e0");
      p.rect(4, 3, 1, 36, "#b9b4aa");
      p.px(3, 1, "#e9b73d");
      p.px(4, 1, "#e9b73d");
      p.rect(3, 2, 2, 1, "#c9971f");
      // The flag, a column at a time so it can ripple.
      const W = 11;
      for (let x = 0; x < W; x++) {
        const dy = frame === 0 ? (x > 6 ? 1 : 0) : x > 3 && x < 9 ? 1 : 0;
        const left = 5 + x;
        p.rect(left, 3 + dy, 1, 8, RED);
        if (x === 3 || x === 4) p.rect(left, 3 + dy, 1, 8, WHITE);
        p.px(left, 6 + dy, WHITE);
        p.px(left, 7 + dy, WHITE);
        p.px(left, 2 + dy, "rgba(20,16,28,0.5)");
        p.px(left, 11 + dy, "rgba(20,16,28,0.3)");
      }
    }),
);

// MARK: A candle in a window

/** A candle on a sill, 3 wide and 6 tall with its flame; the foot of it at the bottom row. */
export const windowCandle = cached(
  (lit: boolean) => String(lit),
  (lit: boolean) =>
    bake(3, 7, (p) => {
      p.rect(1, 4, 2, 3, CREAM);
      p.px(0, 6, "#9a8a60");
      p.px(1, 6, "#9a8a60");
      p.px(2, 6, "#9a8a60");
      p.rect(1, 6, 2, 1, "#cfc6aa");
      if (lit) {
        p.px(1, 2, FLAME);
        p.px(1, 3, FLAME);
        p.px(1, 1, FLAME_TIP);
      }
    }),
);

// MARK: Henning

/** The old man under the cap: a plain look (his coat is outfit 4). */
const HENNING_LOOK: Look = {
  style: 0,
  skin: 1,
  hair: 4,
  outfit: 4,
  glasses: 0,
  hat: 0,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

// Pixel art reads as a grid.
// prettier-ignore
const GREY_HAIR = {
  down: ["................", "................", "................", "................", "...gh......hg...", "...g........g...", "................", "......wwww......", ".....w....w....."],
  side: ["................", "................", "................", "................", "...g............", "...gh...........", "................", ".......www......", "........w......."],
};
// Pixel art reads as a grid.
// prettier-ignore
const SCARF = {
  down: ["................", "................", "................", "................", "................", "................", "................", "................", "................", ".....rrrrrr.....", ".....rwrwrr....."],
  side: ["................", "................", "................", "................", "................", "................", "................", "................", "................", "......rrrr......", "......rwrw......"],
};

/** Henning, the storyteller: grey at the temples and moustache, a flat cap, a red scarf, a cane in his hand. */
export const henningFrame = cached(
  (facing: Facing, _breath: 0 | 1) => facing,
  (facing: Facing) =>
    bake(16, 16, (p) => {
      const view = facing === "down" || facing === "up" ? "down" : "side";
      const flip = facing === "left";
      p.g.drawImage(characterFrame(HENNING_LOOK, facing, "stand"), 0, 0);
      if (facing !== "up") {
        p.grid(GREY_HAIR[view], { g: "#d8d6d0", h: "#b8b6b0", w: "#e8e6e0" }, 0, 0, flip);
        p.grid(SCARF[view], { r: "#a8202c", w: WHITE }, 0, 0, flip);
      }
      p.grid(FLAT_CAP[facing === "up" ? "up" : view === "down" ? "down" : "side"]!, FLAT_CAP.pal, 0, 0, flip);
      // The cane, in the hand on the far side from where he looks.
      const cx = view === "down" ? 13 : flip ? 3 : 12;
      p.rect(cx, 10, 1, 5, "#6e4a2a");
      p.px(cx, 9, "#8d6a3e");
    }),
);
