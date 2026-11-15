import { C } from "../palette.ts";
import { PETS } from "../pets.ts";
import { type Patch, type PetVariant, swap, up } from "./types.ts";

// Pet 3 is the dog. The index is fixed, so the lookup cannot miss.
const BASE = PETS[3]!;

const GOLDEN: Patch[] = [
  [4, 0, "b"],
  [5, 0, "f"],
  [3, 7, "E"],
  [4, 7, "E"],
  [5, 6, "E"],
  [5, 7, "E"],
  [6, 4, "d"],
  [6, 5, "d"],
  [7, 2, "d"],
  [7, 3, "d"],
  [7, 4, "d"],
  [7, 5, "d"],
  [5, 8, "f"],
  [5, 9, "f"],
  [6, 6, "f"],
  [6, 7, "f"],
  [7, 6, "f"],
  [7, 7, "f"],
  [7, 8, "f"],
];

const DALMATIAN_SPOTS: Patch[] = [
  [4, 8, "x"],
  [5, 7, "x"],
  [6, 5, "x"],
  [7, 7, "x"],
  [7, 3, "x"],
  [3, 10, "x"],
];

const HUSKY_MARKINGS: Patch[] = [
  [3, 9, "w"],
  [3, 10, "w"],
  [4, 9, "w"],
  [4, 10, "w"],
  [5, 8, "w"],
  [5, 9, "w"],
  [6, 6, "w"],
  [6, 7, "w"],
  [7, 6, "w"],
  [7, 7, "w"],
  [7, 8, "w"],
];

const SHIBA_MARKINGS: Patch[] = [
  [4, 9, "c"],
  [4, 10, "c"],
  [5, 8, "c"],
  [5, 9, "c"],
  [6, 6, "c"],
  [6, 7, "c"],
  [7, 7, "c"],
  [7, 8, "c"],
  [7, 4, "c"],
  [7, 5, "c"],
];

/** Colour swaps of the dog. Shapes are in dog-shapes.ts. */
export const DOG_SWAPS: PetVariant[] = [
  // White coat, black spots, dark ears. The hop frame moves the spots up a row with the body.
  swap(
    BASE,
    "dalmatian",
    "Dalmatian",
    { b: C.white, E: "#3b3440", x: "#3b3440" },
    DALMATIAN_SPOTS,
    up(DALMATIAN_SPOTS),
  ),
  // Grey coat, white mask, chest and belly, pale blue eyes.
  swap(
    BASE,
    "husky",
    "Husky",
    { b: "#8d96a3", E: "#6f7885", w: C.white, e: "#bfe6ff" },
    HUSKY_MARKINGS,
    up(HUSKY_MARKINGS),
  ),
  // Red-orange coat with cream cheeks, chest and belly.
  swap(
    BASE,
    "shiba",
    "Shiba",
    { b: "#d9713c", E: "#8f4424", c: "#f6e7c8" },
    SHIBA_MARKINGS,
    up(SHIBA_MARKINGS),
  ),
  // Rich golden coat, darker gold back and big floppy ears, cream chest, feathery tail and belly.
  swap(
    BASE,
    "golden",
    "Golden retriever",
    { b: "#f2bd36", E: "#a86a18", d: "#d08e1e", f: "#fff0c4" },
    GOLDEN,
    up(GOLDEN),
  ),
];
