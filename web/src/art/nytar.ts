import { COSTUME_BASE } from "@tokenmaxxing/core/costumes.ts";
import type { Facing, Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Nytårsaften's 2D art (`game/nytar.ts` draws it): the Nytårsur, the buffet table with its kransekage tower and
 * champagne, the jumping chair, balloons, and the night watchman. All baked once from code; the clock's hands and the
 * garland's bulbs are drawn live over them.
 */

const NAVY = "#26356b";
const NAVY_D = "#1a2552";
const NAVY_L = "#3d52a0";
const GOLD = "#f4c95d";
const GOLD_D = "#c9971f";
const CREAM = "#f3e2bd";
const CREAM_D = "#d9c08c";
const STONE = "#c9c4bb";
const STONE_D = "#a39e95";
const STONE_L = "#e2ded6";

// MARK: The clock

/** The clock's sprite size, where its face is centred in it, and the face's radius (pixels). */
export const CLOCK_PX = { w: 24, h: 58, cx: 12, cy: 24, r: 8 } as const;

/** The Nytårsur: a stone tower with a navy roof, a gold-rimmed face and this year's number on a plate. No hands. */
export const clockSprite = cached(
  (year: number) => String(year),
  (year: number) =>
    bake(CLOCK_PX.w, CLOCK_PX.h, (p) => {
      const { cx, cy, r } = CLOCK_PX;
      // The plinth, the shaft and the year plate.
      p.rect(2, 52, 20, 6, C.ink);
      p.rect(3, 53, 18, 4, STONE);
      p.rect(3, 53, 18, 1, STONE_L);
      p.rect(3, 56, 18, 1, STONE_D);
      p.rect(4, 36, 16, 17, C.ink);
      p.rect(5, 36, 14, 17, STONE);
      p.rect(15, 36, 4, 17, STONE_D);
      for (const y of [41, 48]) p.rect(5, y, 14, 1, STONE_D);
      p.rect(3, 40, 18, 8, C.ink);
      p.rect(4, 41, 16, 6, NAVY);
      p.rect(4, 41, 16, 1, NAVY_L);
      p.text(String(year), 5, 42, GOLD);
      // The head: the clock room, with the face in a gold ring.
      p.rect(2, 13, 20, 24, C.ink);
      p.rect(3, 14, 18, 22, STONE);
      p.rect(3, 14, 18, 1, STONE_L);
      p.rect(16, 14, 5, 22, STONE_D);
      p.rect(2, 34, 20, 3, C.ink);
      p.rect(3, 34, 18, 2, GOLD_D);
      p.disc(cx, cy, r + 2, C.ink);
      p.disc(cx, cy, r + 1, GOLD);
      p.disc(cx, cy, r, CREAM);
      p.px(cx - 4, cy - 6, "#ffffff");
      // The hours: a tick at each quarter, a dot between.
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2;
        const q = h % 3 === 0;
        const d = q ? r - 2 : r - 1;
        const x = Math.round(cx + Math.sin(a) * d);
        const y = Math.round(cy - Math.cos(a) * d);
        p.px(x, y, q ? NAVY_D : GOLD_D);
        if (q) p.px(Math.round(cx + Math.sin(a) * (d - 1)), Math.round(cy - Math.cos(a) * (d - 1)), NAVY_D);
      }
      // The roof and its spire: narrow at the top, widest where it meets the clock room.
      for (let r = 0; r < 12; r++) {
        const half = Math.min(10, 1 + Math.floor(r * 0.85));
        p.rect(cx - half - 1, 2 + r, (half + 1) * 2, 1, C.ink);
      }
      for (let r = 0; r < 12; r++) {
        const half = Math.min(10, 1 + Math.floor(r * 0.85));
        p.rect(cx - half, 2 + r, half * 2, 1, r % 4 === 3 ? NAVY_L : NAVY);
      }
      p.rect(cx - 1, 0, 2, 3, GOLD_D);
      p.px(cx - 1, 0, GOLD);
      p.rect(cx + 1, 0, 3, 2, "#e8584f");
    }),
);

// MARK: The buffet

/** The table's sprite size: two tiles wide, and tall enough for the tower. */
export const TABLE_PX = { w: 32, h: 34 } as const;

/** Kransekage rings from the top down: width of each ring in pixels. */
const RINGS = [2, 4, 5, 6, 8, 9, 10, 12];

/** The buffet: a navy cloth with a gold hem, a kransekage tower on a plate, a champagne bottle and two flutes. */
export const tableSprite = once(() =>
  bake(TABLE_PX.w, TABLE_PX.h, (p) => {
    // The cloth.
    p.rect(1, 20, 30, 14, C.ink);
    p.rect(2, 21, 28, 12, NAVY);
    p.rect(2, 21, 28, 1, "#dfe6ff");
    p.rect(2, 22, 28, 1, NAVY_L);
    p.rect(2, 31, 28, 2, GOLD);
    for (let x = 3; x < 29; x += 3) p.rect(x, 28, 1, 3, NAVY_L);
    // The kransekage tower: rings, each a little zigzag of sugar, a Dannebrog on top.
    let y = 19;
    const mid = 10;
    for (const w of [...RINGS].reverse()) {
      p.rect(mid - w / 2 - 1, y - 2, w + 2, 3, C.ink);
      p.rect(mid - w / 2, y - 2, w, 2, CREAM);
      p.rect(mid - w / 2, y - 2, w, 1, "#fff6dc");
      p.px(mid + w / 2 - 1, y - 1, CREAM_D);
      for (let x = mid - w / 2 + 1; x < mid + w / 2 - 1; x += 2) p.px(x, y - 1, CREAM_D);
      y -= 2;
    }
    p.rect(mid, y - 3, 1, 4, C.ink);
    p.rect(mid + 1, y - 4, 4, 3, C.ink);
    p.rect(mid + 1, y - 3, 3, 2, "#d8283a");
    p.px(mid + 2, y - 3, C.white);
    p.px(mid + 2, y - 2, C.white);
    // The plate under it.
    p.rect(3, 19, 15, 1, C.white);
    // The bottle: dark green, a gold foil neck.
    p.rect(21, 7, 5, 14, C.ink);
    p.rect(22, 11, 3, 9, "#1f5f3a");
    p.rect(23, 11, 1, 9, "#3b8a58");
    p.rect(22, 8, 3, 4, GOLD);
    p.rect(23, 6, 1, 2, GOLD_D);
    p.rect(22, 15, 3, 3, CREAM);
    // Two flutes, bubbly.
    for (const x of [17, 27]) {
      p.rect(x, 12, 3, 8, C.ink);
      p.rect(x + 1, 13, 1, 6, "#fbe9a6");
      p.px(x + 1, 15, C.white);
      p.rect(x, 19, 3, 1, C.ink);
    }
  }),
);

// MARK: The chair

export const CHAIR_PX = { w: 14, h: 18 } as const;

/** The chair to jump from: wood, a navy cushion, a gold streamer on the back. */
export const chairSprite = once(() =>
  bake(CHAIR_PX.w, CHAIR_PX.h, (p) => {
    p.rect(2, 1, 10, 9, C.ink);
    p.rect(3, 2, 8, 7, C.wood);
    p.rect(3, 2, 8, 1, C.woodLight);
    for (const x of [4, 6, 8, 10]) p.rect(x - 1, 3, 1, 5, C.woodDark);
    p.rect(1, 9, 12, 5, C.ink);
    p.rect(2, 10, 10, 3, NAVY);
    p.rect(2, 10, 10, 1, NAVY_L);
    for (const x of [2, 10]) {
      p.rect(x, 13, 2, 5, C.ink);
      p.rect(x, 13, 1, 4, C.woodDark);
    }
    // A streamer tied to the back.
    p.rect(11, 3, 2, 1, GOLD);
    p.rect(12, 4, 1, 4, GOLD);
    p.px(11, 8, GOLD_D);
  }),
);

// MARK: Balloons

export const BALLOON_PX = { w: 16, h: 30 } as const;
const BALLOON_COLOURS = [
  ["#f4c95d", "#c9971f"],
  ["#ff5d73", "#c93a52"],
  ["#5ee0ff", "#2f9bbd"],
  ["#b18cff", "#7f5bd0"],
  ["#fbf7ef", "#cfc9bd"],
] as const;

/** A bunch of three balloons on strings, `n` picks the colours. */
export const balloonSprite = cached(
  (n: number) => String(n),
  (n: number) =>
    bake(BALLOON_PX.w, BALLOON_PX.h, (p) => {
      const at: [number, number][] = [
        [4, 5],
        [11, 7],
        [8, 3],
      ];
      for (const [i, [bx, by]] of at.entries()) {
        const [main, dark] = BALLOON_COLOURS[(n + i * 2) % BALLOON_COLOURS.length]!;
        // The string, down to the knot at the bottom.
        p.rect(bx, by + 4, 1, 22 - by - 4 + 4, "#6b6578");
        p.disc(bx, by, 4, C.ink);
        p.disc(bx, by, 3, main);
        p.px(bx - 1, by - 2, C.white);
        p.px(bx + 2, by + 2, dark);
        p.px(bx + 1, by + 3, dark);
      }
      p.rect(7, 26, 3, 2, C.ink);
      p.rect(8, 26, 1, 1, GOLD);
    }),
);

// MARK: The night watchman

/** Who Niels is under the hat. */
const WATCHMAN_LOOK: Look = {
  style: 0,
  skin: 1,
  hair: 4,
  outfit: 5,
  glasses: 0,
  hat: COSTUME_BASE + 56,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

/** A glowing hand lantern, hanging at his side. */
// Pixel art reads as a grid.
// prettier-ignore
const LANTERN = [
  ".o.",
  "oyo",
  "oYo",
  ".o.",
];

/** A grey moustache over the mouth. */
const MOUSTACHE = { down: ["......mmmm......", ".....m....m....."], side: ["........mmmm...."] };

/** Nattevagt Niels, standing, 16 x 20 with his feet at the bottom: the midnight top hat, a lantern, a scarf. */
export const watchmanSprite = cached(
  (facing: Facing, breath: 0 | 1) => `${facing}:${breath}`,
  (facing: Facing, breath: 0 | 1) =>
    bake(16, 20, (p) => {
      const view = facing === "down" || facing === "up" ? "down" : "side";
      const flip = facing === "left";
      p.g.drawImage(characterFrame(WATCHMAN_LOOK, facing, "stand"), 0, 4);
      if (facing !== "up") p.grid(MOUSTACHE[view], { m: "#d9d3c6" }, 0, 11, flip);
      // The scarf, gold, and a lantern swinging a pixel.
      p.rect(5, 14, 6, 2, GOLD);
      p.px(5, 16, GOLD_D);
      p.px(6, 16, GOLD);
      p.grid(LANTERN, { o: C.ink, y: "#ffe08a", Y: "#ffb43a" }, facing === "left" ? 1 : 12, 14 + breath);
    }),
);

/** The registry entry (`NPC_SPRITES.nytar`). */
export const nytarNpcSprite = (facing: Facing, breath: 0 | 1): HTMLCanvasElement =>
  watchmanSprite(facing, breath);
