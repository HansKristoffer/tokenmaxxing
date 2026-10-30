import { CANDY_COLORS, type StoneKind } from "@tokenmaxxing/core/spooky.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { C } from "./palette.ts";
import { bake, cached, once } from "./pixels.ts";

/**
 * Halloween's 2D sprites (`game/spooky.ts`, the 3D ones are `render3d/town/halloween3d-models.ts`): bats, ghosts,
 * the cauldron, cobwebs, the lawn's extra tombstones, sweets, and Gerda.
 */

const BLACK = "#14091f";
const BONE = "#eef2ff";
const SHADE = "#b9c0e6";

// MARK: Bats and ghosts

// Pixel art reads as a grid.
// prettier-ignore
const BAT = [
  ["oo.....oo", "ooo.o.ooo", ".ooooooo.", "..ooooo..", "...o.o..."],
  ["...o.o...", ".ooooooo.", "ooooooooo", "oo.ooo.oo", "o.......o"],
];

/** A bat, wings up (0) or down (1): 9 x 5. */
export const batSprite = cached(
  (frame: number) => `bat:${frame}`,
  (frame: number) => bake(9, 5, (p) => p.grid(BAT[frame]!, { o: BLACK })),
);

// prettier-ignore
const GHOST = [
  "....oooo....",
  "..ooWWWWoo..",
  ".oWWWWWWWWo.",
  ".oWWWWWWWWo.",
  "oWWkkWWkkWWo",
  "oWWkkWWkkWWo",
  "oWWWWkkWWWWo",
  "oWWWWkkWWWWo",
  "oWWWWWWWWWSo",
  "oWWWWWWWWSSo",
  "oWWWWWWWWSSo",
  "oWWWWWWWSSSo",
];
// prettier-ignore
const HEM = [
  ["oWWo.WWo.WWo", ".oo..oo..oo."],
  [".oWWo.WWo.Wo", "..oo..oo..o."],
];

/** A ghost, white or blue, hem one way (0) or the other (1): 12 x 14. */
export const ghostSprite = cached(
  (hue: "white" | "blue", frame: number) => `ghost:${hue}:${frame}`,
  (hue: "white" | "blue", frame: number) =>
    bake(12, 14, (p) =>
      p.grid([...GHOST, ...HEM[frame]!], {
        o: hue === "blue" ? "#3a5a7a" : "#5a5f8c",
        W: hue === "blue" ? "#bff0ff" : BONE,
        S: hue === "blue" ? "#7fc8e0" : SHADE,
        k: "#1b1f2a",
      }),
    ),
);

// MARK: The cauldron

/** The cauldron, its brew bubbling one of three ways: 16 x 14, feet at the bottom. */
export const cauldronSprite = cached(
  (frame: number) => `cauldron:${frame}`,
  (frame: number) =>
    bake(16, 14, (p) => {
      const iron = "#2b2b34";
      const rim = "#46465a";
      p.rect(2, 12, 12, 2, C.shadow);
      // Legs, then the belly.
      p.rect(3, 11, 2, 3, BLACK);
      p.rect(11, 11, 2, 3, BLACK);
      p.disc(8, 8, 6, BLACK);
      p.disc(8, 8, 5, iron);
      p.rect(4, 9, 3, 2, "#3b3b48");
      // The rim and the brew.
      p.rect(2, 3, 12, 2, BLACK);
      p.rect(3, 3, 10, 1, rim);
      p.rect(3, 4, 10, 1, "#7CFC5A");
      p.rect(4, 4, 3, 1, "#b8ff9a");
      // Bubbles rise and burst.
      const b = [
        [5, 2],
        [9, 1],
        [11, 3],
      ] as const;
      for (let i = 0; i < 3; i++) {
        const [x, y] = b[(i + frame) % 3]!;
        p.px(x, y - (frame === i ? 1 : 0), "#b8ff9a");
        if ((i + frame) % 3 === 1) p.px(x + 1, y - 1, "#7CFC5A");
      }
    }),
);

// MARK: Cobweb and sweets

/** A cobweb for the top-left corner of a door (flip it for the right): 8 x 8, spokes and sagging threads. */
export const cobwebSprite = once(() =>
  bake(8, 8, (p) => {
    const web = "rgba(250,248,255,0.98)";
    const thin = "rgba(232,228,248,0.8)";
    for (let i = 0; i < 8; i++) {
      p.px(i, 0, web);
      p.px(0, i, web);
      p.px(i, i, thin);
    }
    for (let i = 0; i < 6; i++) {
      p.px(i + 1, Math.floor((i + 1) / 2), thin);
      p.px(Math.floor((i + 1) / 2), i + 1, thin);
    }
    for (const r of [3, 5, 7]) for (let x = 1; x < r; x++) p.px(x, r - x + (x % 2 === 0 ? 0 : 0), thin);
    p.px(6, 6, BLACK);
  }),
);

/** A wrapped sweet, a colour from `CANDY_COLORS`: 5 x 3. */
export const candySprite = cached(
  (c: number) => `candy:${c}`,
  (c: number) =>
    bake(5, 3, (p) => {
      const col = CANDY_COLORS[c % CANDY_COLORS.length]!;
      p.rect(1, 0, 3, 3, col);
      p.px(0, 1, "#fbf7ef");
      p.px(4, 1, "#fbf7ef");
      p.px(2, 0, "#ffffffaa");
    }),
);

// MARK: The lawn's tombstones

const STONE_MARK: Record<string, string> = { BRB: "BRB", "404": "404", TODO: "TD", "RIP npm": "RIP" };

/** An unclaimed tombstone: round, a cross or a leaning slab, with a short word on it: 16 x 20. */
export const extraStoneSprite = cached(
  (kind: StoneKind, text: string) => `xstone:${kind}:${text}`,
  (kind: StoneKind, text: string) =>
    bake(16, 20, (p) => {
      p.rect(0, 19, 16, 1, C.shadow);
      if (kind === "cross") {
        p.rect(6, 2, 4, 15, C.ink);
        p.rect(2, 5, 12, 4, C.ink);
        p.rect(7, 3, 2, 13, C.stone);
        p.rect(3, 6, 10, 2, C.stone);
        p.rect(7, 3, 1, 13, C.stoneLight);
        p.rect(9, 6, 3, 2, C.stoneDark);
      } else if (kind === "slab") {
        p.rect(2, 6, 12, 12, C.ink);
        p.rect(3, 7, 10, 10, C.stoneDark);
        p.rect(3, 7, 10, 2, C.stoneLight);
        p.rect(3, 7, 1, 10, C.stoneLight);
      } else {
        p.rect(4, 1, 8, 1, C.ink);
        p.rect(2, 2, 2, 1, C.ink);
        p.rect(12, 2, 2, 1, C.ink);
        p.rect(1, 3, 1, 14, C.ink);
        p.rect(14, 3, 1, 14, C.ink);
        p.rect(4, 2, 8, 1, C.stoneLight);
        p.rect(2, 3, 12, 14, C.stone);
        p.rect(2, 3, 1, 13, C.stoneLight);
        p.rect(13, 3, 1, 14, C.stoneDark);
      }
      if (kind !== "cross")
        p.text(
          STONE_MARK[text] ?? text.slice(0, 3),
          kind === "slab" ? 4 : 3,
          kind === "slab" ? 10 : 6,
          C.ink,
        );
      // The mound, and a tuft of grass.
      p.rect(1, 16, 14, 3, C.trunkDark);
      p.rect(2, 16, 12, 1, C.trunk);
      p.px(3, 15, C.leafDark);
      p.px(12, 15, C.leafDark);
    }),
);

// MARK: Gerda

const CLOAK = "#4b2a78";
const CLOAK_DARK = "#2a1646";
const SKIN = "#e8c39e";
const HAIR = "#d8d4e8";

/** Gerda, the gravekeeper: a hooded purple cloak, grey hair, a lantern she swings. 16 x 20, feet at the bottom. */
export const gerdaSprite = cached(
  (facing: Facing, breath: 0 | 1) => `gerda:${facing}:${breath}`,
  (facing: Facing, breath: 0 | 1) =>
    bake(16, 20, (p) => {
      const flip = facing === "left";
      const side = facing === "left" || facing === "right";
      const rect = (x: number, y: number, w: number, h: number, c: string) =>
        p.rect(flip ? 16 - x - w : x, y, w, h, c);
      // The cloak, wider toward the hem.
      for (let y = 9; y < 19; y++) {
        const half = 3 + Math.floor((y - 9) * 0.55);
        rect(8 - half - 1, y, half * 2 + 2, 1, BLACK);
        rect(8 - half, y, half * 2, 1, y > 14 ? CLOAK_DARK : CLOAK);
      }
      rect(5, 11, 1, 6, CLOAK_DARK);
      // An orange trim at the hem, and the boots.
      rect(3, 18, 10, 1, "#e8772a");
      rect(5, 19, 2, 1, BLACK);
      rect(9, 19, 2, 1, BLACK);
      // The hood.
      p.disc(8, 5, 5, BLACK);
      p.disc(8, 5, 4, CLOAK);
      rect(5, 9, 6, 1, CLOAK_DARK);
      if (facing === "up") {
        rect(5, 3, 6, 5, CLOAK_DARK);
      } else {
        // The face: a wrinkly oval under the hood, grey hair at the sides.
        rect(side ? 6 : 5, 3, side ? 4 : 6, 5, SKIN);
        rect(side ? 5 : 4, 3, 1, 4, HAIR);
        if (!side) rect(11, 3, 1, 4, HAIR);
        const eye = side ? [8] : [6, 9];
        for (const x of eye) rect(x, 5, 1, 1, BLACK);
        rect(side ? 8 : 7, 7, 2, 1, "#b87a6a");
        // A nose.
        if (side) rect(10, 5, 1, 2, SKIN);
      }
      // The lantern on its crook, swinging a pixel.
      const sway = breath;
      rect(side ? 11 : 12, 11, 1, 5, BLACK);
      rect(side ? 10 : 11, 12 + sway, 3, 1, "#8a5a2b");
      rect(side ? 10 : 11, 13 + sway, 3, 3, "#ffc23a");
      rect(side ? 11 : 12, 14 + sway, 1, 1, "#fff2b0");
      rect(side ? 10 : 11, 16 + sway, 3, 1, BLACK);
      // Her free hand.
      rect(side ? 7 : 4, 13, 2, 2, SKIN);
    }),
);

/** The lantern's glow (`game/spooky.ts`) is drawn at this point on Gerda's sprite. */
export const GERDA_LANTERN = [12, 14] as const;
