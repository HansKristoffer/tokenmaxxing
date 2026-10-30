import type { Look } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import type { Art } from "./editions.ts";
import type { NpcSprite } from "./festive-npc.ts";
import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Sankt Hans in 2D (`core/src/midsommer.ts`, `web/src/game/midsommer.ts`): the Dannebrog on its pole, the picnic
 * blanket, the door wreath, the straw heks on her broom, the three hats and the båltaler. All drawn in code.
 */

const DANNEBROG = "#c8102e";

// MARK: Hats

const o = C.ink;

// Pixel art reads as a grid.
// prettier-ignore
/** The three hats (`costumes.ts` 50 to 52), 2D art keyed by item id (`editions.ts` spreads them in). */
export const MIDSOMMER_HAT_ART: Record<string, Art> = {
  // Midsommerkrans: birch leaves round the head with cornflowers, daisies and poppies, a red ribbon behind.
  "hat.250": {
    down: ["................", "....y..r..b.y...", "...lLlrLlLybLl..", "..lLlLllLlLllLl.", "...R..........R."],
    side: ["................", "......y..r.b....", "....lLlLrLyLl...", "...lLlLllLlLlLl.", "..R.............."],
    up: ["................", "....y..r..b.y...", "...lLlrLlLybLl..", "..lLlLllLlLllLl.", "...R.RRRRRR.R..."],
    pal: { l: "#72bf52", L: "#3a7b2f", y: "#f5d14a", r: "#e8584f", b: "#6d9cf0", R: DANNEBROG },
  },
  // Heksehat: a black witch's cone with a straw band and a brass buckle.
  "hat.251": {
    down: [".......oo.......", "......okko......", ".....okkkko.....", "....okSSyySko...", "..okkkkkkkkkkko."],
    side: [".......oo.......", "......okko......", ".....okkkko.....", "....okSSSSSko...", "..okkkkkkkkkkko."],
    pal: { o, k: "#2a2433", S: "#e3c35a", y: "#f5c842" },
  },
  // Strå-hat: a wide straw hat with a Dannebrog ribbon.
  "hat.252": {
    down: ["................", ".....oooooo.....", "....oSSssSSo....", "....orrwrrro....", "..oSSSSSSSSSSSo."],
    side: ["................", ".....oooooo.....", "....oSSssSSSo...", "....orrwrrrro...", "..oSSSSSSSSSSSo."],
    pal: { o, S: "#e8c964", s: "#cfa84a", r: DANNEBROG, w: C.white },
  },
};

// MARK: Scenery

/** The flag pole's size in pixels: the pole stands in the middle of its tile, feet at the bottom. */
export const FLAG_PX = { w: 16, h: 34 } as const;

/** A Dannebrog on a white pole with a gold ball, flapping (`wave` 0 or 1). */
export const flagSprite = cached(
  (wave: number) => String(wave),
  (wave: number) =>
    bake(FLAG_PX.w, FLAG_PX.h, (p) => {
      p.rect(5, 32, 6, 2, C.shadow);
      p.rect(5, 31, 4, 2, C.stoneDark);
      p.rect(6, 4, 2, 28, "#e9e4d8");
      p.rect(7, 4, 1, 28, "#bdb6a6");
      p.disc(7, 3, 1, "#f5c842");
      // The cloth: red, a white cross set toward the pole, its free edge rippling by a pixel.
      for (let x = 0; x < 8; x++) {
        const dy = wave && x > 4 ? 1 : 0;
        p.rect(8 + x, 5 + dy, 1, 7, DANNEBROG);
        if (x === 2 || x === 3) p.rect(8 + x, 5 + dy, 1, 7, C.white);
        p.rect(8 + x, 7 + dy, 1, 2, C.white);
      }
    }),
);

/** A wreath for a door: birch leaves and field flowers with a red bow. */
export const wreathSprite = once(() =>
  bake(12, 12, (p) => {
    const ring: [number, number][] = [
      [5, 0],
      [7, 0],
      [3, 1],
      [9, 1],
      [1, 3],
      [11, 3],
      [0, 5],
      [11, 6],
      [1, 8],
      [10, 8],
      [3, 10],
      [8, 10],
      [5, 11],
      [6, 11],
    ];
    for (const [x, y] of ring) p.rect(x, y, 2, 2, C.leaf);
    for (const [x, y] of ring.filter((_, i) => i % 2)) p.px(x, y, C.leafLight);
    for (const [x, y] of ring.filter((_, i) => i % 3 === 0)) p.px(x, y + 1, C.leafDark);
    p.px(5, 0, C.flowerRed);
    p.px(1, 3, C.flowerWhite);
    p.px(11, 3, C.flowerYellow);
    p.px(0, 6, C.flowerYellow);
    p.px(10, 8, C.flowerRed);
    p.px(3, 10, C.flowerWhite);
    p.px(8, 10, "#6d9cf0");
    // The bow at the bottom.
    p.rect(4, 10, 2, 2, DANNEBROG);
    p.rect(7, 10, 2, 2, DANNEBROG);
    p.px(6, 11, "#8e0c20");
  }),
);

/** A red and white picnic blanket two tiles wide, with a basket and two cups. */
export const blanketSprite = once(() =>
  bake(32, 14, (p) => {
    p.rect(0, 12, 32, 2, C.shadow);
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 32; x++) {
        const a = Math.floor(x / 4) % 2;
        const b = Math.floor(y / 4) % 2;
        p.px(x, y, a === b ? "#fbf7ef" : a ? "#e0a8a0" : DANNEBROG);
      }
    p.rect(0, 0, 32, 1, "#8e0c20");
    p.rect(0, 11, 32, 1, "#8e0c20");
    // The basket: wicker, a handle, a loaf poking out and a napkin.
    p.rect(19, 3, 9, 6, "#a9783f");
    p.rect(19, 3, 9, 1, "#c99a58");
    p.rect(20, 5, 7, 1, "#8a5c2c");
    p.rect(21, 1, 5, 2, "#d9a95a");
    p.rect(23, 1, 1, 1, "#f1dfb6");
    p.rect(20, 2, 1, 1, "#8a5c2c");
    p.rect(27, 2, 1, 1, "#8a5c2c");
    // Two cups.
    for (const x of [6, 12]) {
      p.rect(x, 6, 3, 3, "#4f8fe0");
      p.px(x, 6, "#a8c8f4");
    }
    // A sausage on a plate.
    p.rect(3, 3, 5, 3, "#f1e6d2");
    p.rect(4, 4, 3, 1, "#c85a40");
  }),
);

/** The little straw witch on her broom, flying left (draw it flipped for the other way). */
export const heksSprite = cached(
  (frame: number) => String(frame),
  (frame: number) =>
    bake(26, 16, (p) => {
      // The broom: a stick, straw bristles at the back (right).
      p.rect(2, 9, 20, 1, "#6e4a2a");
      p.rect(21, 7, 5, 5, "#e3c35a");
      p.rect(22, 8, 4, 1, "#c9a73f");
      p.rect(22, 10, 4, 1, "#c9a73f");
      // The witch: a black hat, a straw face and dress, riding.
      p.rect(8, 5, 6, 4, "#e3c35a");
      p.rect(9, 3, 4, 3, "#f2d9a0");
      p.rect(7, 2, 8, 1, o);
      p.rect(9, 0, 4, 3, o);
      p.rect(11 - frame, 0, 2, 1, o);
      p.rect(6, 8 + frame, 2, 2, "#e3c35a");
      p.rect(14, 9, 2, 3 - frame, "#e3c35a");
      p.px(10, 4, o);
    }),
);

// MARK: The båltaler

/** Birgit's look: a woman in her fifties with a flower wreath in her blonde-grey bun, a long green dress. */
export const BALTALER_LOOK: Look = {
  style: 3,
  skin: 0,
  hair: 3,
  outfit: 6,
  glasses: 0,
  hat: 250,
  pet: 0,
  held: 0,
  back: 0,
  petwear: 0,
  petVariant: 0,
  merch: 0,
  merchWorn: 0,
};

export const baltalerSprite: NpcSprite = cached(
  (facing, breath) => `${facing}${breath}`,
  (facing, breath) =>
    bake(16, 16, (p) => {
      p.g.drawImage(characterFrame(BALTALER_LOOK, facing, breath ? "walkA" : "stand"), 0, 0);
    }),
);
