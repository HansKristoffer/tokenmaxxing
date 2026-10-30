import { ORNAMENTS, type Ornament } from "@tokenmaxxing/core/christmas.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, type Pen } from "./pixels.ts";

/**
 * Christmas's 2D sprites (`game/christmas.ts`, theme in `core/src/christmas.ts`): the tree with its ornaments, gifts,
 * a snowman, a doorstep nisse, a wreath, a candle, a julehjerte, and Nisse Knud. Julerød, pine and cream, as J-dag's
 * truck (`art/jdag.ts`). Cached by what they show, so the tree is baked a few dozen times a window, not a frame.
 */

export const RED = "#b3262e";
export const RED_DARK = "#8c1d24";
export const CREAM = "#fbf7ef";
export const GREEN = "#2f6b3a";
export const GREEN_LIGHT = "#3f8a4c";
export const GREEN_DARK = "#1f4a29";
export const GOLD = "#e8c44a";
export const SILVER = "#c9d3dc";
export const SNOW = "#f4f8ff";
export const SNOW_SHADE = "#dbe6f3";
export const BULBS = ["#ff5a5a", "#f5d14a", "#5fd38a", "#6fb4ff"];
const GREY = "#5c6370";
const GREY_DARK = "#444b57";
const SKIN = "#f2c29b";

// MARK: The tree

/** The tree's sprite size: two tiles wide, three tall, its trunk's tile in the middle at the bottom. */
export const TREE_PX = { w: 32, h: 48 } as const;
/** Where its star and its middle top are, for the night's glow (from the sprite's top left). */
export const STAR_AT: readonly [number, number] = [16, 3];

/** The foliage's half width at row `y` of the sprite: a cone from a point at row 4 to 15 at row 40. */
const halfWidth = (y: number): number => 1 + (14 * (y - 4)) / 36;

/** The sprite row an ornament at height `h` (0 bottom .. 1 top) sits on. */
const rowOf = (h: number): number => Math.round(38 - h * 32);

/** Where an ornament is on the sprite (x, y), or null when it hangs round the back. */
export function ornamentPx(o: Pick<Ornament, "a" | "h">): [number, number] | null {
  if (Math.cos(o.a) < -0.15) return null;
  const y = rowOf(o.h);
  return [Math.round(16 + Math.sin(o.a) * halfWidth(y) * 0.78), y];
}

function heart(p: Pen, x: number, y: number, c: string): void {
  p.px(x, y, c);
  p.px(x + 2, y, c);
  p.rect(x, y + 1, 3, 1, c);
  p.px(x + 1, y + 2, c);
}

function foliage(p: Pen): void {
  // Tiers from the bottom up, so each overlaps the one below; an ink edge, then the green.
  const tiers = [
    { top: 30, bot: 40, hw: 15, c: GREEN },
    { top: 23, bot: 33, hw: 12.5, c: GREEN_LIGHT },
    { top: 16, bot: 26, hw: 10, c: GREEN },
    { top: 9, bot: 19, hw: 7.5, c: GREEN_LIGHT },
    { top: 3, bot: 12, hw: 5, c: GREEN },
  ];
  for (const { top, bot, hw, c } of tiers) {
    for (let y = top; y <= bot; y++) {
      const w = Math.max(0.5, (hw * (y - top)) / (bot - top)) + 0.5;
      p.rect(Math.round(16 - w) - 1, y, Math.round(w * 2) + 2, 1, C.ink);
    }
    for (let y = top + 1; y <= bot - 1; y++) {
      const w = Math.max(0.5, (hw * (y - top)) / (bot - top)) + 0.5;
      p.rect(Math.round(16 - w), y, Math.round(w * 2), 1, c);
    }
    // The shadow under the tier's edge, and a fleck of snow on its branch tip.
    p.rect(Math.round(16 - hw * 0.5), bot - 1, Math.round(hw), 1, GREEN_DARK);
    p.px(Math.round(16 - hw * 0.6), bot - 2, SNOW);
    p.px(Math.round(16 + hw * 0.5), bot - 3, SNOW);
  }
}

function tub(p: Pen): void {
  p.rect(14, 38, 4, 4, "#6b4a2a");
  p.rect(9, 41, 14, 7, C.ink);
  p.rect(10, 42, 12, 5, RED);
  p.rect(10, 42, 12, 1, RED_DARK);
  p.rect(10, 44, 12, 1, CREAM);
  p.rect(10, 41, 12, 1, SNOW);
}

/** The positions a player's own julehjerter take on the tree (up to eight, one a day), front and low. */
export const OWN_HEARTS: readonly [number, number][] = [
  [10, 33],
  [19, 34],
  [14, 28],
  [21, 28],
  [12, 22],
  [18, 22],
  [15, 15],
  [14, 9],
];

/**
 * The tree with its first `shown` ornaments (`ORNAMENTS`), the star if `star`, and `own` of the player's own julehjerter.
 * The lights are drawn dim here; the night's glow (and the twinkle) is `game/christmas.ts`.
 */
export const treeSprite = cached(
  (shown: number, star: boolean, own: number) => `${shown}:${star}:${own}`,
  (shown: number, star: boolean, own: number) =>
    bake(TREE_PX.w, TREE_PX.h, (p) => {
      foliage(p);
      tub(p);
      for (const [i, o] of ORNAMENTS.slice(0, shown).entries()) {
        const at = ornamentPx(o);
        if (!at) continue;
        const [x, y] = at;
        switch (o.set) {
          case "lightsLow":
          case "lightsUp":
            p.px(x, y, BULBS[o.hue]!);
            break;
          case "red":
          case "gold": {
            const c = o.set === "red" ? RED : GOLD;
            p.rect(x, y, 2, 2, c);
            p.px(x, y, o.set === "red" ? "#e8584f" : "#fff0a8");
            p.px(x + 1, y + 2, C.ink);
            break;
          }
          case "hearts":
            heart(p, x - 1, y, i % 2 ? RED : CREAM);
            p.px(x, y + 1, i % 2 ? CREAM : RED);
            break;
          case "flags":
            p.px(x, y, i % 2 ? RED : CREAM);
            p.px(x + 1, y, i % 2 ? CREAM : RED);
            p.px(x, y + 1, i % 2 ? RED : CREAM);
            break;
          case "tinsel":
            p.px(x, y, SILVER);
            p.px(x + 1, y + 1, SILVER);
            p.px(x + 2, y, SILVER);
            break;
        }
      }
      for (const [x, y] of OWN_HEARTS.slice(0, own)) {
        heart(p, x, y, "#ff4f6e");
        p.px(x + 1, y + 1, "#ffd0da");
      }
      if (star) {
        // A five-point star on the tip, in gold with a bright centre.
        p.rect(15, 0, 3, 5, C.ink);
        p.rect(13, 2, 7, 2, C.ink);
        p.rect(16, 0, 1, 5, GOLD);
        p.rect(14, 2, 5, 2, GOLD);
        p.rect(15, 1, 3, 4, GOLD);
        p.px(16, 2, "#fff6c0");
        p.px(16, 3, "#fff6c0");
      }
    }),
);

// MARK: Gifts, a snowman, a nisse, a wreath

const GIFT_COLOURS: readonly [string, string][] = [
  [RED, CREAM],
  [GREEN, GOLD],
  ["#4f8fe0", SILVER],
  [CREAM, RED],
];

/** A wrapped box, 8×7, in one of four colourways. */
export const giftSprite = cached(
  (i: number) => String(i % GIFT_COLOURS.length),
  (i: number) => {
    const [box, ribbon] = GIFT_COLOURS[i % GIFT_COLOURS.length]!;
    return bake(8, 7, (p) => {
      p.rect(0, 2, 8, 5, C.ink);
      p.rect(1, 3, 6, 3, box);
      p.rect(3, 3, 2, 3, ribbon);
      p.rect(1, 4, 6, 1, ribbon);
      p.rect(2, 1, 4, 2, C.ink);
      p.px(2, 1, ribbon);
      p.px(5, 1, ribbon);
      p.px(3, 2, ribbon);
      p.px(4, 2, ribbon);
    });
  },
);

/** A snowman, 10×16: three snowballs, a coal face, a carrot, a red scarf and a black hat. */
export const snowmanSprite = cached(
  () => "snowman",
  () =>
    bake(10, 16, (p) => {
      p.rect(2, 0, 6, 2, C.ink);
      p.rect(3, 0, 4, 2, "#3a3546");
      p.rect(1, 2, 8, 1, C.ink);
      p.disc(5, 5, 3, C.ink);
      p.disc(5, 5, 2, SNOW);
      p.px(4, 4, C.ink);
      p.px(6, 4, C.ink);
      p.px(5, 5, "#e8772a");
      p.px(6, 5, "#e8772a");
      p.rect(2, 7, 6, 1, RED);
      p.px(7, 8, RED);
      p.px(7, 9, RED);
      p.disc(5, 10, 3, C.ink);
      p.disc(5, 10, 2, SNOW);
      p.px(6, 11, SNOW_SHADE);
      p.px(5, 10, C.ink);
      p.disc(5, 13, 3, C.ink);
      p.disc(5, 13, 2, SNOW);
      p.rect(2, 14, 6, 1, SNOW_SHADE);
      p.px(5, 12, C.ink);
      p.px(5, 14, C.ink);
      p.px(0, 9, "#6b4a2a");
      p.px(1, 9, "#6b4a2a");
      p.px(9, 9, "#6b4a2a");
    }),
);

/** The doorstep nisse, 12×14 (its cap dropping to one side), with a bowl of risalamande; `facing` is the way it looks. */
export const nisseSprite = cached(
  (facing: "left" | "right") => facing,
  (facing: "left" | "right") =>
    bake(12, 14, (p) => {
      if (facing === "left") {
        p.g.translate(12, 0);
        p.g.scale(-1, 1);
      }
      p.rect(2, 0, 3, 1, CREAM);
      p.rect(3, 1, 4, 1, C.ink);
      p.rect(4, 1, 2, 1, CREAM);
      p.rect(3, 2, 5, 3, C.ink);
      p.rect(4, 2, 3, 3, RED);
      p.rect(2, 4, 8, 2, C.ink);
      p.rect(3, 4, 6, 1, RED);
      p.rect(3, 5, 6, 1, RED_DARK);
      p.rect(3, 6, 6, 4, C.ink);
      p.rect(4, 6, 4, 3, CREAM);
      p.px(5, 6, SKIN);
      p.px(6, 6, SKIN);
      p.rect(2, 8, 8, 4, C.ink);
      p.rect(3, 9, 6, 3, GREY);
      p.px(3, 11, GREY_DARK);
      p.rect(3, 12, 2, 2, C.ink);
      p.rect(7, 12, 2, 2, C.ink);
      // The bowl in front.
      p.rect(8, 10, 4, 4, C.ink);
      p.rect(9, 11, 2, 2, CREAM);
      p.px(10, 11, RED);
    }),
);

/** A door wreath, 9×9 (the Tavern's 13×13): pine, three berries and a red bow. */
export const wreathSprite = cached(
  (big: boolean) => String(big),
  (big: boolean) => {
    const s = big ? 11 : 9;
    const c = (s - 1) / 2;
    return bake(s, s + 2, (p) => {
      // A ring: pine, with an ink edge on both sides.
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const d = Math.hypot(x - c, y - c);
          if (d > c + 0.4 || d < c - 3.3) continue;
          p.px(x, y, d > c - 0.6 || d < c - 2.5 ? C.ink : GREEN);
        }
      p.px(c - 2, 1, GREEN_LIGHT);
      p.px(c + 2, s - 3, GREEN_LIGHT);
      p.px(1, c, RED);
      p.px(s - 2, c + 1, RED);
      p.px(c + 1, 1, RED);
      // The bow, low in the middle.
      p.rect(c - 2, s - 2, 2, 2, RED);
      p.rect(c + 1, s - 2, 2, 2, RED);
      p.px(c, s - 1, RED_DARK);
      p.px(c - 1, s, RED);
      p.px(c + 1, s, RED);
      p.px(c, s - 2, GOLD);
    });
  },
);

/** A candle in the window: 3×6, a cream stick and a yellow flame (lit or not). */
export const candleSprite = cached(
  (lit: boolean) => String(lit),
  (lit: boolean) =>
    bake(3, 7, (p) => {
      p.rect(0, 3, 3, 4, C.ink);
      p.rect(1, 3, 1, 4, CREAM);
      if (lit) {
        p.px(1, 0, "#ffd45a");
        p.px(1, 1, "#ffe89a");
        p.px(1, 2, "#ffd45a");
      } else p.px(1, 2, C.ink);
    }),
);

/** A julehjerte, 5×5, red and white woven. */
export const julehjerteSprite = cached(
  () => "hjerte",
  () =>
    bake(5, 5, (p) => {
      p.px(0, 0, RED);
      p.px(1, 0, CREAM);
      p.px(3, 0, CREAM);
      p.px(4, 0, RED);
      p.rect(0, 1, 5, 1, CREAM);
      p.px(0, 1, RED);
      p.px(2, 1, RED);
      p.px(4, 1, RED);
      p.rect(1, 2, 3, 1, RED);
      p.px(2, 2, CREAM);
      p.px(1, 3, CREAM);
      p.px(3, 3, CREAM);
      p.px(2, 4, RED);
    }),
);

/** A candy-cane stripe for a lamp post (4 wide, 18 tall): red and white bands, the hook at the top. */
export const candyCaneSprite = cached(
  () => "cane",
  () =>
    bake(6, 20, (p) => {
      for (let y = 4; y < 20; y++) {
        p.rect(1, y, 4, 1, (y >> 1) % 2 ? RED : CREAM);
        p.px(0, y, C.ink);
        p.px(5, y, C.ink);
      }
      p.rect(1, 0, 4, 1, C.ink);
      p.rect(0, 1, 6, 3, C.ink);
      p.rect(1, 1, 4, 2, RED);
      p.px(2, 1, CREAM);
      p.px(3, 2, CREAM);
    }),
);

// MARK: Nisse Knud

/** Knud's sprite size: 16×20, feet at the bottom. */
export const KNUD_PX = { w: 16, h: 20 } as const;

function knudFront(p: Pen, breath: 0 | 1, back: boolean): void {
  // Boots.
  p.rect(4, 17, 3, 3, C.ink);
  p.rect(9, 17, 3, 3, C.ink);
  p.rect(5, 17, 1, 2, "#4a3f56");
  p.rect(10, 17, 1, 2, "#4a3f56");
  // The coat: broad, dark grey, a belt and a gold buckle.
  p.rect(2, 8, 12, 10, C.ink);
  p.rect(3, 9, 10, 8, GREY);
  p.rect(10, 9, 3, 8, GREY_DARK);
  p.rect(3, 14, 10, 1, "#2b2433");
  p.rect(7, 14, 2, 1, GOLD);
  p.rect(3, 16, 10, 1, GREY_DARK);
  // Arms, ending in dark mittens.
  p.rect(1, 10, 2, 6, C.ink);
  p.rect(13, 10, 2, 6, C.ink);
  p.rect(1, 11, 1, 3, GREY);
  p.rect(14, 11, 1, 3, GREY_DARK);
  p.rect(1, 14, 2, 2, "#2b2433");
  p.rect(13, 14, 2, 2, "#2b2433");
  if (!back) {
    // The bowl of rice pudding, held out low in front.
    p.rect(9, 13 - breath, 6, 4, C.ink);
    p.rect(10, 14 - breath, 4, 2, CREAM);
    p.px(11, 14 - breath, RED);
    p.rect(8, 15 - breath, 2, 2, "#2b2433");
    // The beard: white, to the chest, a point at the bottom; the nose over it.
    p.rect(3, 6, 10, 8, C.ink);
    p.rect(4, 7, 8, 6, CREAM);
    p.rect(5, 13, 6, 1, C.ink);
    p.rect(6, 13, 4, 1, CREAM);
    p.rect(4, 11, 8, 1, "#d6cfbd");
    p.rect(5, 12, 6, 1, "#d6cfbd");
    p.rect(7, 7, 2, 2, SKIN);
  } else {
    p.rect(3, 6, 10, 8, C.ink);
    p.rect(4, 7, 8, 6, CREAM);
    p.rect(4, 11, 8, 1, "#d6cfbd");
  }
  // The cap: a cone, down over the eyes, its tip drooping to the side with a pompom.
  p.rect(3, 4, 10, 4, C.ink);
  p.rect(4, 5, 8, 2, RED);
  p.rect(4, 6, 8, 1, RED_DARK);
  p.rect(5, 1, 6, 4, C.ink);
  p.rect(6, 2, 4, 3, RED);
  p.rect(7, 0, 4, 2, C.ink);
  p.rect(8, 1, 2, 1, RED);
  p.rect(10, 0 + breath, 3, 3, C.ink);
  p.rect(11, 0 + breath, 2, 2, CREAM);
}

function knudSide(p: Pen, breath: 0 | 1): void {
  p.rect(4, 17, 4, 3, C.ink);
  p.rect(9, 17, 3, 3, C.ink);
  p.rect(3, 8, 9, 10, C.ink);
  p.rect(4, 9, 7, 8, GREY);
  p.rect(4, 15, 7, 1, "#2b2433");
  p.rect(4, 9, 2, 7, GREY_DARK);
  // The bowl held out in front (to the right).
  p.rect(10, 11 - breath, 5, 5, C.ink);
  p.rect(11, 12 - breath, 3, 3, CREAM);
  p.px(12, 12 - breath, RED);
  p.rect(8, 13 - breath, 3, 2, "#2b2433");
  p.rect(5, 6, 8, 9, C.ink);
  p.rect(6, 7, 6, 7, CREAM);
  p.rect(6, 12, 6, 1, "#dcd6c8");
  p.rect(11, 8, 2, 2, SKIN);
  p.rect(4, 4, 8, 4, C.ink);
  p.rect(5, 5, 6, 2, RED);
  p.rect(5, 6, 6, 1, RED_DARK);
  p.rect(3, 1, 7, 4, C.ink);
  p.rect(4, 2, 5, 3, RED);
  p.rect(1, 1 + breath, 4, 4, C.ink);
  p.rect(2, 2 + breath, 2, 2, CREAM);
}

/** Nisse Knud (`FESTIVE_NPC.christmas`): grey coat, a red cap down over his eyes, a great white beard, a bowl of rice pudding. */
export const knudSprite = cached(
  (facing: Facing, breath: 0 | 1) => `${facing}:${breath}`,
  (facing: Facing, breath: 0 | 1) =>
    bake(KNUD_PX.w, KNUD_PX.h, (p) => {
      if (facing === "down") knudFront(p, breath, false);
      else if (facing === "up") knudFront(p, breath, true);
      else {
        if (facing === "left") {
          p.g.translate(KNUD_PX.w, 0);
          p.g.scale(-1, 1);
        }
        knudSide(p, breath);
      }
    }),
);
