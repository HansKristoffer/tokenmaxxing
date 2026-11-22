import { JULEMARKED_BASE } from "@tokenmaxxing/core/case-julemarked.ts";
import { patch } from "./case-julemarked.ts";
import { frameAt, frontView } from "./prestige-types.ts";
import type { Back, BackView, Held, Outfit } from "./wardrobe.ts";

/**
 * The Julemarked case's outfits, held things and back items in 2D (`core/src/case-julemarked.ts`). Same shapes as
 * the Ragnarok Eve's in `case-ragnarok-body.ts`; `wardrobe.ts` merges these in under their look indices
 * (`JULEMARKED_BASE + n`). Design and palette: `docs/cases/julemarked.md`.
 */

const at = (n: number) => JULEMARKED_BASE + n;
const ink = "#2b2433";

// MARK: Outfits

/** A row of `s` whose first pixel is at column `x` (a row of marks, 16 wide). */
const markRow = (x: number, s: string): string => (".".repeat(x) + s).padEnd(16, ".");
const blank = markRow(0, "");

// Marks sit over the body from row 9 (down to row 15 for a long gown or boots). The second walking frame (`walk`)
// is laid over them. Rarity shows: the commons carry one signature detail, the uncommons a few, the epics move.
// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_OUTFITS: Record<number, Outfit> = {
  // Islandsk sweater: cream wool, a bold red and green snowflake yoke, a ribbed hem, gold thread that sparkles.
  [at(0)]: {
    c: "#f4ecd8", C: "#d8cdb0", p: "#4a4a52",
    marks: {
      down: [markRow(5, "yRwwRR"), markRow(4, "RGwwwwGR"), markRow(5, "RRwwRy"), markRow(5, "CwCwCw")],
      side: [markRow(6, "ywwR"), markRow(5, "RwwGwR"), markRow(5, "RwwR"), markRow(6, "CwCw")],
      up: [markRow(5, "yRwwRR"), markRow(4, "RGwwwwGR"), markRow(5, "RRwwRy"), markRow(5, "CwCwCw")],
    },
    walk: {
      down: patch(4, [5, 0, "R"], [10, 2, "R"], [10, 0, "y"], [5, 2, "y"], [7, 1, "y"]),
      side: patch(4, [6, 0, "R"], [8, 2, "y"], [7, 1, "y"]),
      up: patch(4, [5, 0, "R"], [10, 2, "R"], [10, 0, "y"], [5, 2, "y"], [7, 1, "y"]),
    },
    pal: { w: "#f4ecd8", R: "#b8302c", G: "#2f5d3a", C: "#d8cdb0", y: "#f2c14e" },
  },
  // Bagerforklæde: a cream apron over a red shirt, neck loop, a wooden spoon in the pocket, flour that puffs as you walk.
  [at(1)]: {
    c: "#b8302c", C: "#8e2220", p: "#5a4a3a",
    marks: {
      down: [markRow(5, "a....a"), markRow(5, "aafaSa"), markRow(5, "aaaaSa"), markRow(5, "aaAnnn")],
      side: [markRow(7, "a"), markRow(6, "aafa"), markRow(6, "aaSa"), markRow(6, "annn")],
      up: [markRow(5, "a....a"), markRow(5, "tttttt"), markRow(7, "tt"), markRow(5, "AAAAAA")],
    },
    walk: {
      down: patch(4, [13, 2, "f"], [14, 1, "f"], [2, 2, "f"], [1, 3, "f"], [12, 3, "f"], [6, 2, "f"]),
      side: patch(4, [12, 1, "f"], [13, 2, "f"], [3, 2, "f"], [2, 3, "f"], [7, 2, "f"]),
      up: patch(4, [13, 2, "f"], [14, 1, "f"], [2, 2, "f"], [1, 3, "f"]),
    },
    pal: { a: "#f4ecd8", A: "#d8cdb0", f: "#ffffff", n: "#b89a5a", S: "#a06a3c", t: "#8a5a32" },
  },
  // Nissedragt: grey wool with a knit texture, a bulky hood with a pointed tail on the back, a red scarf, clogs.
  [at(2)]: {
    c: "#8a8f98", C: "#6c7078", p: "#6c7078",
    marks: {
      down: [markRow(4, "GggggggG"), markRow(4, "RRRRRRRR"), markRow(5, "RrgCgC"), markRow(5, "CgCgCg"), blank, blank, markRow(5, "n....n")],
      side: [markRow(3, "Gggggg"), "..GgRRRRRR......", "..Gg.RrgC.......", "..ww.CgCg.......", blank, blank, markRow(5, "n...n")],
      up: [markRow(4, "GggggggG"), markRow(5, "GgggggG"), markRow(6, "GggG"), markRow(7, "Gg"), markRow(7, "ww"), blank, markRow(5, "n....n")],
    },
    walk: {
      down: patch(4, [5, 2, "g"], [6, 2, "C"], [9, 2, "R"], [10, 2, "r"]),
      side: patch(4, [6, 2, "g"], [7, 2, "C"]),
    },
    pal: { G: "#6c7078", g: "#a3a8b0", C: "#6c7078", R: "#b8302c", r: "#8e2220", w: "#f4ecd8", n: "#a06a3c" },
  },
  // Dannebrog-trøje: a red knit with the white Nordic cross stitched on, a gleam that glides along the arm.
  [at(3)]: {
    c: "#c8102e", C: "#9c0c24", p: "#4a4a52",
    marks: {
      down: [markRow(5, "wWCCCC"), markRow(4, "wWwWxWwW"), markRow(5, "wW"), markRow(5, "CCCCCC")],
      side: [markRow(7, "wW"), markRow(5, "wWwWxW"), markRow(7, "wW"), markRow(5, "CCCCCC")],
      up: [markRow(5, "CCCCCC"), markRow(7, "wW"), blank, markRow(5, "CCCCCC")],
    },
    walk: {
      down: patch(4, [8, 1, "w"], [5, 1, "x"]),
      side: patch(4, [9, 1, "W"], [6, 1, "x"]),
    },
    pal: { w: "#f1e9d6", W: "#d9cdb0", x: "#ffffff", C: "#9c0c24" },
  },
  // Julemandsdragt: a red coat with a fur collar, placket and hem, a wide black belt with a gold buckle, a white beard and bushy brows.
  [at(4)]: {
    c: "#b8302c", C: "#8e2220", p: "#a82a28",
    marks: {
      down: [markRow(4, "wWwwwwWw"), markRow(4, "RRRwwRRR"), markRow(5, "kkyYkk"), markRow(4, "wwwwwwww")],
      side: [markRow(4, "wWwwww"), markRow(5, "RRwwRR"), markRow(5, "kkyYk"), markRow(5, "wwwwww")],
      up: [markRow(4, "wWwwwwWw"), blank, markRow(5, "kkkkkk"), markRow(4, "wwwwwwww")],
    },
    walk: { down: patch(4, [7, 2, "x"]), side: patch(4, [7, 2, "x"]) },
    brows: { down: [markRow(4, "wWw..wWw")], side: [markRow(8, "wWww")], up: [] },
    beard: {
      down: [markRow(5, "wWwwWw"), markRow(4, "wwwwwwww"), markRow(4, "wWwwwwWw"), markRow(5, "wwWWww"), markRow(7, "ww")],
      side: [markRow(8, "wWww"), markRow(6, "wwwwww"), markRow(6, "wwWww"), markRow(7, "wwww")],
      up: [],
    },
    pal: { w: "#ffffff", W: "#dfe3ea", R: "#b8302c", k: "#2b2433", y: "#f2c14e", Y: "#c9971f", x: "#ffffff" },
  },
  // Lucia-tog: a long white gown that trails to the ground, a red sash and a candle at each side, flickering in a halo.
  [at(5)]: {
    c: "#f6f2ea", C: "#d8d2c4", p: "#e6e0d2",
    marks: {
      down: [
        ".hOh.RR.....hOh.", "..W...RR.....W..", "..V....RR....V..", markRow(4, "owwwRRwo"),
        markRow(3, "owwswwRswo"), markRow(2, "oswwswwRwwso"), markRow(2, "oooooooooooo"),
      ],
      side: [
        markRow(5, "RR....hOh"), markRow(6, "RR....W"), markRow(7, "RR....V"), markRow(4, "owwwRRo"),
        markRow(3, "owwswwwwo"), markRow(1, "oswwswwwwwso"), markRow(1, "oooooooooooo"),
      ],
      up: [
        ".hOh....RR..hOh.", "..W....RR....W..", "..V...RR.....V..", markRow(4, "owRRwwwo"),
        markRow(3, "owwswwwswo"), markRow(2, "oswwswwswwso"), markRow(2, "oooooooooooo"),
      ],
    },
    walk: {
      down: patch(3, [2, 0, "y"], [13, 0, "y"], [1, 0, "h"]),
      side: patch(3, [12, 0, "y"]),
      up: patch(3, [2, 0, "y"], [13, 0, "y"]),
    },
    pal: {
      w: "#fdfaf2", s: "#e2dccb", R: "#b8302c", y: "#fff0a0", O: "#f08a3c",
      h: "#f2c14e66", W: "#fffbe8", V: "#cbbf9f", o: ink,
    },
  },
};

// MARK: In the hand

// `h` is the hand: the item is placed so that it lands on the character's hand (and, past it, within 16 columns).
// `walk` is the second walking frame, the same shape as `rows`.
// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_HELD: Record<number, Held> = {
  // Gløgg mug: a cream mug with a red band, dark wine with an almond and raisin, an orange slice on the rim, a
  // cinnamon stick, and steam that curls up and sways as you walk.
  [at(0)]: {
    rows: ["..s.s.", ".s.s.T", ".OOoT.", ".oMao.", "howwo.", ".orro.", ".owwo.", ".oooo."],
    walk: [".s.s..", "..s.sT", ".OOoT.", ".oMao.", "howwo.", ".orro.", ".owwo.", ".oooo."],
    pal: { o: ink, w: "#f4ecd8", r: "#b8302c", M: "#5a1f2e", a: "#d9b98a", s: "#e6e9ee", T: "#8a4a2a", O: "#f08a3c" },
  },
  // Brændte mandler: a cream paper cone with a red stripe, a heap of glazed almonds, sugar that sparkles.
  [at(1)]: {
    rows: ["..x...", ".bgBbx", "obBgbo", "orrrro", "owwwwo", "howwo.", ".orro.", "..oo.."],
    walk: ["x....x", ".bgBb.", "obBgbo", "orrrro", "owwwwo", "howwo.", ".orro.", "..oo.."],
    pal: { o: ink, w: "#f4ecd8", r: "#b8302c", b: "#a8703a", B: "#6b3f22", g: "#d9a86a", x: "#ffffff" },
  },
  // Æbleskiver: a plate of golden puffs dusted with powdered sugar (a puff of it rises), a dollop of red jam.
  [at(2)]: {
    rows: ["..j.x.", ".ggGgg", "gxGgxg", "hooooo", ".owwo.", "..oo.."],
    walk: [".x..x.", ".ggGgg", "gxGgxg", "hooooo", ".owwo.", "..oo.."],
    pal: { o: ink, w: "#f4ecd8", g: "#d49a3a", G: "#a8702a", x: "#ffffff", j: "#b8302c" },
  },
  // Pebernød tin: a round red tin with a hearts band, the lid ajar, pepper nuts spilling out.
  [at(3)]: {
    rows: ["..wwo.", ".owwo.", ".oNNo.", "hoRwoN", ".oRRoN", ".oRRo.", "..oo.N"],
    walk: ["...wwo", ".owwo.", ".oNNo.", "hoRwo.", ".oRRoN", ".oRRoN", "..oo.."],
    pal: { o: ink, w: "#f4ecd8", R: "#b8302c", N: "#6b3f22" },
  },
  // Flæskestegssandwich: a bun half out of its paper, pink pork, glistening amber crackling, red cabbage, a parsley leaf.
  [at(4)]: {
    rows: ["..oBBo", ".oBgBo", ".oyxyo", "hopmpo", ".oppyo", ".oBBBo", ".owRwo", "..ooo."],
    walk: ["..oBBo", ".oBgBo", ".oyyxo", "hopmpo", ".oppyo", ".oBBBo", ".owRwo", "..ooo."],
    pal: { o: ink, B: "#c98a4a", p: "#e8a6a0", y: "#d9a031", m: "#7a2f5a", w: "#f4ecd8", R: "#b8302c", g: "#4f9a5c", x: "#fff6c8" },
  },
};

// MARK: On the back

/** An empty 16×16 frame, then `rows` dropped in at row `y`. */

// The sack's glint is a red bow pixel turning white on the walking frame, on row 1.
const glintRow = (glint: boolean) => (row: string, y: number) =>
  glint && y === 1 ? row.replace("RwwR", "RxwR") : row;

// Gavesæk: a lumpy, overflowing wood-brown sack tied with a red cord, a gift and a candy cane peeking out, a glint.
const sackUp = (glint: boolean): string[] =>
  frameAt(
    [
      ".....oyyo.oo....",
      "....oRwwRoGGo...",
      "....oRwwRooGo...",
      "..obbbbRRbbbbo..",
      ".obbBbbbRbbbBbo.",
      ".obbbbBbbbbbbbo.",
      ".obBbbbbbBbbbbo.",
      "..obbbBbbbbbbo..",
      "...oooooooooo...",
    ].map(glintRow(glint)),
    6,
  );
const sackSide = (glint: boolean): string[] =>
  frameAt(
    [
      "..oyyo..oRo.....",
      ".oRwwRooRwo.....",
      ".oRwwRoowRo.....",
      "oGRRRRoooGGo....",
      "oobbbRRbbbboo...",
      "obbBbbRbbbbbbo..",
      "obbbbBbbbbBbbo..",
      "obBbbbbbbbbbbo..",
      "obbbbbBbbbbbbo..",
      ".obbBbbbbbbbo...",
      "..oobbBbbboo....",
      "....ooooooo.....",
    ].map(glintRow(glint)),
    3,
  );
/** From the front the sack hangs behind the shoulders: its lumps stick out each side, a gift corner over one. */
const sackDown = (glint: boolean): BackView => ({
  behind: frameAt(
    [
      "..........oyyo..",
      ".........oRwwRo.",
      ".ooo.....oRwwRo.",
      "obbbo...obbbbbbo",
      "obBbbo.obbbBbbbo",
      "obbbbbo.obbbbbbo",
      ".obbBbo.obbbBbbo",
      "..oobbo..obbbboo",
      "....ooo...oooo..",
    ].map(glintRow(glint)),
    4,
  ),
  front: frameAt([".....o....o.....", "....oRo..oRo....", ".....o....o....."], 8),
});

// Julehjerte-vinger: BIG woven paper-heart wings, red and white, that flap as you walk, little hearts drifting down.
const WING_L = ["..oo", ".oRw", "oRwR", "owRw", "oRwo", "owRo", ".oRw", "oRwR", "owRw", "oRwo", "..oo"];
/** The right wing is the left one mirrored. */
const flip = (row: string) => [...row].reverse().join("");
const heart = (x: number, y: number): [number, number, string][] => [
  [x, y, "R"],
  [x + 2, y, "R"],
  [x, y + 1, "R"],
  [x + 1, y + 1, "R"],
  [x + 2, y + 1, "R"],
  [x + 1, y + 2, "R"],
];
/**
 * Both wings from row `y`: the left one's rows, the right one mirrored. `drift` places little hearts at
 * [column, row] pairs.
 */
const wings = (y: number, left: string[], drift: [number, number][]): string[] => {
  const g = frameAt(
    left.map((l) => `${l}........${flip(l)}`),
    y,
  ).map((row) => [...row.padEnd(16, ".")]);
  while (g.length < 16) g.push(Array<string>(16).fill("."));
  for (const [x, hy] of drift) {
    for (const [px, py, c] of heart(x, hy)) {
      if (g[py]) g[py]![px] = c;
    }
  }
  return g.map((row) => row.join(""));
};
// Wings raised: the same wing a little shorter and tipped up.
const WING_UP = WING_L.slice(1, 10);
/** From the side only the wings' first four columns show; the rest of each row is left empty. */
const wingsSide = (y: number, left: string[], drift: [number, number][]): string[] =>
  wings(y, left, drift).map((row) => `${row.slice(0, 4)}............`);

// Pixel art reads as a grid.
// prettier-ignore
export const JULEMARKED_BACKS: Record<number, Back> = {
  // Gavesæk: the sack over one shoulder, lumps out each side from the front, a gift peeking out and a glint.
  [at(0)]: {
    views: {
      down: sackDown(false),
      side: { behind: sackSide(false) },
      up: frontView(sackUp(false)),
    },
    walk: {
      down: sackDown(true),
      side: { behind: sackSide(true) },
      up: frontView(sackUp(true)),
    },
    pal: { o: ink, b: "#a06a3c", B: "#7e4f2a", R: "#b8302c", G: "#2f5d3a", w: "#f4ecd8", y: "#f2c14e", x: "#ffffff" },
  },
  // Julehjerte-vinger: woven paper hearts folded into big wings, flapping, with little hearts floating down.
  [at(1)]: {
    views: {
      down: { behind: wings(1, WING_L, [[0, 13]]) },
      side: { behind: wingsSide(1, WING_L, [[0, 13]]) },
      up: frontView(wings(1, WING_L, [[0, 13]])),
    },
    walk: {
      down: { behind: wings(0, WING_UP, [[1, 11], [12, 13]]) },
      side: { behind: wingsSide(0, WING_UP, [[1, 11]]) },
      up: frontView(wings(0, WING_UP, [[1, 11], [12, 13]])),
    },
    pal: { o: ink, R: "#b8302c", w: "#f4ecd8" },
  },
};
