/**
 * The Julemarked, the town's Christmas market. It is not a shop: a festive gate stands on a block of its own
 * next to the square (a permanent, reserved block, like a shop's) and is only open from J-dag to 26 December
 * (`julemarkedOn`, december.ts). Through the gate is a separate walled outdoor courtyard, the room
 * "julemarked", with four stalls under snow-white roofs and a Christmas tree. Nissens bod sells the
 * `julemarked` case (E opens the case shop on its shelf); the other three sell for coins (julemarked-shop.ts:
 * E opens the Shop page on that stall's goods). This file holds the tiles and the plan; the art is in web/src/art/julemarked.ts and
 * web/src/render3d/rooms/julemarked3d.ts.
 */

/** The gate's body in the town: 7 wide, 3 deep, with a three-tile opening in the middle of its bottom row. */
export const JULE_GATE_BODY = "Ǻ";
/** The gate's opening: walk into it to enter the market. */
export const JULE_GATE_DOOR = "Ȣ";
/** The gate's footprint in its block, from the block's top-left tile: columns 2 to 8, rows 4 to 6. */
export const JULE_GATE = { x: 2, y: 4, w: 7, h: 3 } as const;

/** Nissens bod (the case stall), Julegodter, Julepynt and Den varme bod: one tile char each, 5 wide and 3 deep. */
export const STALL_CHAR = { nissen: "Ǥ", godter: "Ǫ", pynt: "Ȃ", varme: "Ʃ" } as const;
export type StallId = keyof typeof STALL_CHAR;
export const STALL_IDS: readonly StallId[] = ["nissen", "godter", "pynt", "varme"];
/** The Christmas tree: 2 by 2 tiles. */
export const JULE_TREE = "Ȝ";

export interface Stall {
  id: StallId;
  ch: string;
  name: string;
  /** Its top-left tile in the market room. */
  x: number;
  y: number;
  /** What E says in a plain reading (tests, hints); in play E opens Nissens bod's case panel or the other stalls' Shop page. */
  text: string;
}
export const STALL_W = 5;
export const STALL_H = 3;

export const STALLS: readonly Stall[] = [
  {
    id: "nissen",
    ch: STALL_CHAR.nissen,
    name: "Nissens bod",
    x: 2,
    y: 2,
    text: "Nissens bod. Press E to open the Julemarked case.",
  },
  {
    id: "godter",
    ch: STALL_CHAR.godter,
    name: "Julegodter",
    x: 17,
    y: 2,
    text: "Julegodter. Gløgg in paper cups, æbleskiver under a drift of powdered sugar and burnt almonds by the bag. The queue is mostly one family, and they are not leaving. Press E to buy.",
  },
  {
    id: "pynt",
    ch: STALL_CHAR.pynt,
    name: "Julepynt",
    x: 2,
    y: 9,
    text: "Julepynt. Paper hearts, straw stars and tiny wooden nisser, each one a little crooked on purpose. Press E to browse.",
  },
  {
    id: "varme",
    ch: STALL_CHAR.varme,
    name: "Den varme bod",
    x: 17,
    y: 9,
    text: "Den varme bod. Wool hats, mittens and a very patient pony in a jumper. Everything here is warm. Press E to browse.",
  },
];

export const JULEMARKED_W = 24;
export const JULEMARKED_H = 16;
/** The Christmas tree's top-left tile. */
export const JULE_TREE_AT: [number, number] = [11, 6];
/** The market's exit, in its bottom wall. */
export const JULE_EXIT_X = 11;

/** The market courtyard: two wall rows on top, a wall all round, paving inside and the exit in the bottom wall. */
export function julemarkedRows(): string[] {
  const grid: string[][] = Array.from({ length: JULEMARKED_H }, (_, y) =>
    Array.from({ length: JULEMARKED_W }, (_, x): string =>
      y <= 1 || y === JULEMARKED_H - 1 || x === 0 || x === JULEMARKED_W - 1 ? "W" : ":",
    ),
  );
  for (const s of STALLS)
    for (let dy = 0; dy < STALL_H; dy++) for (let dx = 0; dx < STALL_W; dx++) grid[s.y + dy]![s.x + dx] = s.ch;
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++) grid[JULE_TREE_AT[1] + dy]![JULE_TREE_AT[0] + dx] = JULE_TREE;
  // Lamps down the sides of the square in front of the stalls.
  for (const [x, y] of [
    [8, 5],
    [15, 5],
    [8, 12],
    [15, 12],
  ] as const)
    grid[y]![x] = "L";
  grid[JULEMARKED_H - 1]![JULE_EXIT_X] = "x";
  return grid.map((r) => r.join(""));
}

/**
 * The gate's block (10 by 9 tiles): a lawn, the gate across the middle, the opening on row 6 (like a shop's
 * door) and the path down to the road. No lamps `L` here: the Easter bunting strings run between every lamp of the town.
 */
export function julemarktLot(): string[] {
  const body = JULE_GATE_BODY.repeat(JULE_GATE.w);
  const front = `${JULE_GATE_BODY.repeat(2)}${JULE_GATE_DOOR.repeat(3)}${JULE_GATE_BODY.repeat(2)}`;
  return [
    ",,,,,,,,,,",
    ",.........",
    ",.........",
    ",.........",
    `,.${body}.`,
    `,.${body}.`,
    `,.${front}.`,
    ",....,....",
    ",....,....",
  ];
}

/** Where the gate stands among the blocks: nearest the square on the north side, next to the shops. */
export const JULEMARKED_BLOCK: [number, number] = [1, -1];
