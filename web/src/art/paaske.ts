import { type CritterKind, EGG_COLOURS, type FlowerKind } from "@tokenmaxxing/core/paaske.ts";
import type { Facing } from "@tokenmaxxing/core/world.ts";
import { characterFrame } from "./characters.ts";
import { C } from "./palette.ts";
import { bake, cached, once, type Pen } from "./pixels.ts";

/**
 * Påske's 2D art (`game/paaske.ts`; the 3D twins are `render3d/town/paaske3d.ts`): flower clumps, painted eggs, lambs,
 * bunnies and chicks, the påskeris, Gudrun's stall and the påskefrokost table, strings of pastel bunting, Gudrun
 * herself and the three costumes' hat art. Everything is baked once.
 */

const INK = C.ink;

/** `draw` on a canvas `w` x `h`, then a one-pixel dark outline round whatever it drew (the canvas grows by 2). */
function outlined(w: number, h: number, draw: (p: Pen) => void, line = "#4a3b42"): HTMLCanvasElement {
  const raw = bake(w + 2, h + 2, (p) => {
    p.g.translate(1, 1);
    draw(p);
  });
  const g = raw.getContext("2d")!;
  const { data } = g.getImageData(0, 0, raw.width, raw.height);
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < raw.width && y < raw.height && data[(y * raw.width + x) * 4 + 3]! > 20;
  g.fillStyle = line;
  for (let y = 0; y < raw.height; y++)
    for (let x = 0; x < raw.width; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)))
        g.fillRect(x, y, 1, 1);
  return raw;
}

// MARK: Flowers

const GREEN = "#4f9b3d";
const GREEN_D = "#3a7b2f";

/** One påskelilje: a yellow star round an orange trumpet, on a stem. (x, y) is the middle of the bloom. */
function narcissus(p: Pen, x: number, y: number): void {
  p.rect(x, y + 3, 1, 5, GREEN);
  p.px(x - 1, y + 6, GREEN_D);
  p.px(x + 1, y + 5, GREEN_D);
  p.rect(x - 1, y - 2, 3, 5, "#f7d23a");
  p.rect(x - 2, y - 1, 5, 3, "#f7d23a");
  p.px(x, y - 2, "#ffe978");
  p.px(x - 2, y, "#ffe978");
  p.px(x + 2, y, "#ffe978");
  p.rect(x, y, 1, 1, "#e8902a");
  p.px(x, y + 1, "#c9701d");
}

/** One vintergæk: a white bell hung from a bent green stem. */
function vintergaek(p: Pen, x: number, y: number): void {
  p.rect(x, y + 2, 1, 6, GREEN);
  p.px(x, y + 1, GREEN);
  p.px(x + 1, y, GREEN);
  p.rect(x + 1, y + 1, 3, 3, "#fbf7ef");
  p.px(x + 2, y + 4, "#fbf7ef");
  p.px(x + 2, y + 3, "#cfe3f0");
  p.px(x + 2, y + 4, "#8cc87a");
  p.px(x + 1, y + 1, "#fbf7ef");
}

/** One tulip: a pink cup on a stem with a leaf. */
function tulip(p: Pen, x: number, y: number): void {
  p.rect(x, y + 3, 1, 5, GREEN);
  p.rect(x + 1, y + 5, 1, 2, GREEN_D);
  p.rect(x - 1, y, 3, 3, "#ec6fa0");
  p.px(x - 1, y - 1, "#ec6fa0");
  p.px(x + 1, y - 1, "#ec6fa0");
  p.px(x, y, "#f9a6c6");
  p.px(x, y + 1, "#c9457b");
}

const BLOOMS: Record<FlowerKind, [(p: Pen, x: number, y: number) => void, [number, number][]]> = {
  narcissus: [
    narcissus,
    [
      [4, 4],
      [8, 2],
      [12, 5],
      [6, 7],
    ],
  ],
  vintergaek: [
    vintergaek,
    [
      [3, 5],
      [7, 3],
      [10, 6],
      [13, 4],
    ],
  ],
  tulip: [
    tulip,
    [
      [4, 4],
      [8, 3],
      [12, 5],
    ],
  ],
};

/** A clump of flowers on a tile: 16 x 14, its bottom on the tile's. */
export const flowerSprite = cached(
  (kind: FlowerKind, variant: number) => `${kind}:${variant}`,
  (kind: FlowerKind, variant: number) =>
    bake(16, 14, (p) => {
      const [bloom, at] = BLOOMS[kind];
      // A little grass tuft under them.
      for (const x of [2, 5, 9, 12]) p.rect(x, 12, 1, 2, "#6aa84a");
      at.forEach(([x, y], i) => {
        if ((i + variant) % 5 !== 4) bloom(p, x, y);
      });
    }),
);

// MARK: Eggs

/** A painted egg lying in the grass, 7 x 8: a base colour with a stripe and a dark outline. */
export const eggSprite = cached(
  (colour: number) => String(colour),
  (colour: number) => {
    const [base, stripe, line] = EGG_COLOURS[colour % EGG_COLOURS.length]!;
    return bake(7, 8, (p) => {
      p.grid(["..lll..", ".lbbbl.", "lbbbbbl", "lssssSl", "lbbbbbl", "lbbbbbl", ".lbbbl.", "..lll.."], {
        l: line,
        b: base,
        s: stripe,
        S: stripe,
      });
      p.px(2, 2, "#ffffff");
      p.px(1, 3, base);
    });
  },
);

/** An egg for the HUD and the hats: bigger, no outline darkening. */
export const eggIcon = cached(
  (colour: number, size: number) => `${colour}:${size}`,
  (colour: number, size: number) => {
    const c = eggSprite(colour);
    return bake(c.width * size, c.height * size, (p) => {
      p.g.imageSmoothingEnabled = false;
      p.g.drawImage(c, 0, 0, c.width * size, c.height * size);
    });
  },
);

// MARK: Lambs, bunnies and chicks

const PALS: Record<CritterKind, Record<string, string>> = {
  chick: { y: "#ffe36a", Y: "#f2c230", O: "#f08a2a", o: "#f08a2a", K: INK },
  bunny: { w: "#f6f1e7", s: "#d4cbbb", p: "#f2a6b8", K: INK, n: "#f08aa0" },
  lamb: { w: "#fbf7ef", s: "#d8d2c6", d: "#4a3f48", K: "#ffffff", e: "#6a5a64" },
};

// Pixel art reads as a grid.
// prettier-ignore
const CRITTER: Record<CritterKind, string[][]> = {
  chick: [
    ["...yyy..", "..yyyyy.", "..yKyyyO", "..yyyyy.", ".yyyyyy.", "yyYYyyy.", ".yyyyy..", "..o.o..."],
    ["...yyy..", "..yyyyy.", "..yKyyyO", "..yyyyy.", ".yyYYyy.", "yyyYYyy.", ".yyyyy..", "...oo..."],
  ],
  bunny: [
    [".......ww..", ".......wpw.", ".......wpw.", "......wwww.", "...wwwwKww.", "..wwwwwwwwn", ".wwwwwwwww.", ".wwwwwwwws.", "wwwwwwwsss.", ".ww.sw.ss.."],
    [".......ww..", ".......wpw.", ".......wpw.", "......wwww.", "...wwwwKww.", "..wwwwwwwwn", ".wwwwwwwww.", ".wwwwwwwws.", "wwwwwwwsss.", "..wwwwwsss.."],
  ],
  lamb: [
    ["..wwwww.....", ".wwwwwwww...", "wwswwwwwwddd", "wwwwswwwddKd", "wwwwwwwwwddd", ".wwswwwww.dd", ".wwwwwwww...", "..d.d..d.d..", "..d.d..d.d.."],
    ["..wwwww.....", ".wwwwwwww...", "wwswwwwwwddd", "wwwwswwwddKd", "wwwwwwwwwddd", ".wwswwwww.dd", ".wwwwwwww...", "..dd...dd...", "............"],
  ],
};

/** A lamb, bunny or chick facing right (or left, mirrored), frame 0 or 1, with an outline. */
export const critterSprite = cached(
  (kind: CritterKind, right: boolean, frame: number) => `${kind}:${right}:${frame}`,
  (kind: CritterKind, right: boolean, frame: number) => {
    const rows = CRITTER[kind][frame % 2]!;
    return outlined(rows[0]!.length, rows.length, (p) => p.grid(rows, PALS[kind], 0, 0, !right));
  },
);

// MARK: The påskeris

/** The branches of birch twigs from the vase at (11, 26): each a run of points. */
const TWIGS: [number, number][][] = [
  [
    [11, 26],
    [11, 22],
    [11, 18],
    [11, 14],
    [11, 10],
    [11, 6],
    [11, 3],
  ],
  [
    [11, 24],
    [9, 21],
    [7, 18],
    [5, 15],
    [4, 11],
    [3, 8],
  ],
  [
    [11, 24],
    [13, 21],
    [15, 18],
    [17, 15],
    [18, 11],
    [19, 8],
  ],
  [
    [11, 17],
    [8, 15],
    [6, 13],
    [4, 12],
  ],
  [
    [11, 17],
    [14, 15],
    [16, 13],
    [18, 12],
  ],
  [
    [11, 11],
    [9, 9],
    [8, 6],
  ],
  [
    [11, 11],
    [13, 9],
    [14, 6],
  ],
];

/** The hanging things: a feather (x, y, colour) or an egg (x, y, colour index) with its thread. */
const FEATHERS: [number, number, string][] = [
  [5, 14, "#f4a6c8"],
  [18, 13, "#9ccff2"],
  [11, 8, "#f7e27a"],
  [8, 19, "#c8aaf0"],
  [15, 20, "#a6dc92"],
  [3, 10, "#f7e27a"],
];
const EGGS: [number, number, number][] = [
  [7, 17, 0],
  [14, 17, 1],
  [11, 12, 2],
  [4, 13, 3],
  [18, 10, 4],
  [9, 8, 5],
  [13, 22, 0],
];

/** The påskeris: bare birch twigs in a blue-and-white vase, 24 x 32, hung with feathers and painted eggs. */
export const treeSprite = once(() =>
  bake(24, 32, (p) => {
    for (const run of TWIGS)
      run.forEach(([x, y], i) => {
        p.px(x, y, i % 2 ? "#8a6a48" : "#a8845c");
        const next = run[i + 1];
        if (next) p.px((x + next[0]) >> 1, (y + next[1]) >> 1, "#6a4c32");
      });
    // Buds on the tips.
    for (const run of TWIGS) {
      const [x, y] = run.at(-1)!;
      p.px(x, y - 1, "#8cc87a");
    }
    for (const [x, y, c] of FEATHERS) {
      p.rect(x, y, 1, 4, c);
      p.rect(x - 1, y + 1, 3, 2, c);
      p.px(x, y + 4, "#ffffff");
    }
    for (const [x, y, c] of EGGS) {
      const [base, stripe] = EGG_COLOURS[c]!;
      p.px(x, y - 1, "#d9d3c6");
      p.rect(x - 1, y, 4, 4, base);
      p.rect(x, y + 4, 2, 1, base);
      p.rect(x - 1, y + 2, 4, 1, stripe);
      p.px(x - 1, y, "#ffffff");
    }
    // The vase.
    p.rect(7, 26, 9, 1, "#d6e4f5");
    p.rect(8, 27, 7, 4, "#eaf1fb");
    p.rect(8, 29, 7, 1, "#4a7bc4");
    p.rect(8, 27, 1, 5, "#c2d3ec");
    p.rect(8, 31, 7, 1, "#8fa8d2");
    p.rect(9, 28, 5, 1, "#4a7bc4");
    p.rect(9, 30, 5, 1, "#4a7bc4");
  }),
);
export const TREE_PX = { w: 24, h: 32 } as const;

// MARK: The stall and the påskefrokost table

/** Gudrun's trestle: paint pots, a brush and a few eggs drying on a plank, 16 x 16. */
export const stallSprite = once(() =>
  bake(16, 16, (p) => {
    p.rect(1, 6, 14, 3, C.woodLight);
    p.rect(1, 9, 14, 1, C.woodDark);
    p.rect(2, 10, 2, 5, C.woodDark);
    p.rect(12, 10, 2, 5, C.woodDark);
    p.rect(7, 10, 2, 5, C.wood);
    // Paint pots.
    for (const [x, c] of [
      [2, "#e8584f"],
      [5, "#f5d14a"],
      [8, "#5fa8e0"],
    ] as const) {
      p.rect(x, 3, 3, 3, c);
      p.rect(x, 3, 3, 1, "#fbf7ef");
    }
    p.px(10, 3, C.woodDark);
    p.px(10, 4, C.woodDark);
    p.px(10, 5, "#e8584f");
    // Eggs on the plank.
    for (const [x, i] of [
      [11, 0],
      [13, 3],
    ] as const) {
      const [base, stripe] = EGG_COLOURS[i]!;
      p.rect(x, 4, 2, 3, base);
      p.px(x, 5, stripe);
      p.px(x + 1, 5, stripe);
    }
  }),
);

/** The påskefrokost table, 32 x 18: a white cloth with a pastel edge; herring, eggs, bread, snaps and narcissi. */
export const frokostSprite = once(() =>
  bake(32, 18, (p) => {
    // Cloth, hanging to the sides.
    p.rect(1, 6, 30, 5, "#fbf7ef");
    p.rect(0, 11, 32, 3, "#e8e2d4");
    p.rect(0, 13, 32, 1, "#d6cfbf");
    for (let x = 0; x < 32; x += 4) p.rect(x, 12, 2, 2, x % 8 ? "#f4a6c8" : "#f7e27a");
    p.rect(3, 14, 2, 4, C.woodDark);
    p.rect(27, 14, 2, 4, C.woodDark);
    // Herring on a blue-rimmed plate, with onion and dill.
    p.rect(3, 5, 8, 2, "#4a7bc4");
    p.rect(4, 4, 6, 2, "#eaf1fb");
    p.rect(4, 4, 4, 1, "#b9c4cf");
    p.px(8, 4, "#9a4a8a");
    p.px(9, 4, "#4f9b3d");
    // Eggs, halved: white with a yolk.
    for (const x of [13, 16, 19]) {
      p.rect(x, 5, 2, 2, "#fbf7ef");
      p.px(x, 5, "#f5c842");
      p.px(x + 1, 5, "#f5c842");
    }
    p.rect(12, 7, 10, 1, "#e8e2d4");
    // Rye bread and butter.
    p.rect(24, 5, 4, 2, "#6b4226");
    p.rect(24, 5, 4, 1, "#8c5c36");
    p.rect(28, 6, 2, 1, "#f5d14a");
    // The snaps: a bottle and two small glasses.
    p.rect(21, 1, 2, 5, "#7fb89a");
    p.px(21, 0, "#7fb89a");
    p.px(22, 3, "#d6efe2");
    p.px(11, 5, "#d6efe2");
    p.px(30, 4, "#d6efe2");
    // A jam jar of narcissi.
    p.rect(1, 3, 2, 3, "#cde9f6");
    p.px(0, 1, "#f7d23a");
    p.px(1, 0, "#f7d23a");
    p.px(2, 1, "#f7d23a");
    p.px(1, 2, "#4f9b3d");
  }),
);

// MARK: Bunting

const PENNANTS = ["#f4a6c8", "#f7e27a", "#9ccff2", "#a6dc92", "#c8aaf0"];

/**
 * A string of pastel bunting `len` pixels long, sagging `sag` pixels in the middle: horizontal (the cord from left to
 * right, the flags hanging down) or vertical (from top to bottom, bowing to the right, the flags pointing left).
 */
export const buntingSprite = cached(
  (len: number, sag: number, vertical: boolean) => `${len}:${sag}:${vertical}`,
  (len: number, sag: number, vertical: boolean) => {
    const w = vertical ? sag + 6 : len;
    const h = vertical ? len : sag + 6;
    return bake(w, h, (p) => {
      const at = (s: number): [number, number] => {
        const drop = Math.round(4 * sag * (s / len) * (1 - s / len));
        return vertical ? [drop, s] : [s, drop];
      };
      for (let s = 0; s <= len; s++) {
        const [x, y] = at(s);
        p.px(x, y, "#7a5a40");
      }
      for (let s = 3, i = 0; s < len - 1; s += 6, i++) {
        const [x, y] = at(s);
        const c = PENNANTS[i % PENNANTS.length]!;
        if (vertical) {
          p.rect(x - 3, y, 3, 1, c);
          p.rect(x - 2, y + 1, 2, 1, c);
          p.px(x - 1, y + 2, c);
        } else {
          p.rect(x, y + 1, 3, 1, c);
          p.rect(x, y + 2, 2, 1, c);
          p.px(x, y + 3, c);
        }
      }
    });
  },
);

// MARK: Gudrun

/** What she is under the hat: a grey bun, a green cardigan. Looks index the palettes (`art/palette.ts`). */
const GUDRUN_LOOK = {
  style: 3,
  skin: 0,
  hair: 2,
  outfit: 3,
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
const STRAW = {
  down: ["................", "................", "....sSSSSSSs....", "...sSssssssSs...", "..sSSSSSSSSSSs..", "...oooooooooo..."],
  side: ["................", "................", "....sSSSSSs.....", "...sSssssssSs...", "..sSSSSSSSSSSSs.", "...oooooooooo..."],
  up: ["................", "................", "....sSSSSSSs....", "...sSSSSSSSSSs..", "..sSSSSSSSSSSs..", "...oooooooooo..."],
};
const STRAW_PAL = { s: "#e8c970", S: "#d4aa4a", o: "#9a7a2e" };

/** Gudrun in her straw hat and red scarf, facing `facing`, breathing 0 or 1: 16 x 16, as a player is. */
export const gudrunSprite = cached(
  (facing: Facing, breath: 0 | 1) => `${facing}:${breath}`,
  (facing: Facing, breath: 0 | 1) => {
    const view = facing === "down" ? "down" : facing === "up" ? "up" : "side";
    const flip = facing === "left";
    return bake(16, 16, (p) => {
      p.g.drawImage(characterFrame(GUDRUN_LOOK, facing, breath ? "walkA" : "stand"), 0, 0);
      // The scarf at her neck, and a basket of eggs held in front.
      if (view === "down") {
        p.rect(5, 8, 6, 2, "#e8584f");
        p.px(10, 10, "#e8584f");
        p.rect(3, 12, 5, 3, "#a8763c");
        p.rect(3, 12, 5, 1, "#d49c67");
        p.px(4, 11, "#f4a6c8");
        p.px(5, 11, "#f7e27a");
        p.px(6, 11, "#9ccff2");
      } else if (view === "side")
        p.grid(["....rrrr........", "................"], { r: "#e8584f" }, 0, 8, flip);
      p.grid(STRAW[view], STRAW_PAL, 0, 0, flip);
    });
  },
);
