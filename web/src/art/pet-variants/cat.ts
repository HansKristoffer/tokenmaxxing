import { C } from "../palette.ts";
import { PETS } from "../pets.ts";
import type { Palette } from "../pixels.ts";
import { type Patch, type PetVariant, swap, up } from "./types.ts";

const BASE = PETS[2]!;

/**
 * A swap whose hop frame is the standing one lifted a row: the patches are written once, for the
 * standing frame, and the hop gets them moved up.
 */
const liftedSwap = (id: string, name: string, pal: Palette, patches: Patch[]) =>
  swap(BASE, id, name, pal, patches, up(patches));

/** Colour swaps of the cat. Shapes are in shapes.ts. */
export const CAT_SWAPS: PetVariant[] = [
  liftedSwap(
    "black",
    "Black cat",
    {
      b: "#4a4353",
      a: "#4a4353",
      h: "#6e6680",
      e: "#f5d14a",
    },
    [
      [3, 0, "h"],
      [4, 1, "h"],
      [2, 7, "h"],
    ],
  ),
  liftedSwap(
    "tuxedo",
    "Tuxedo",
    {
      b: "#2f2a38",
      a: "#2f2a38",
      w: C.white,
    },
    [
      [5, 9, "w"],
      [5, 10, "w"],
      [6, 8, "w"],
      [6, 9, "w"],
      [7, 8, "w"],
      [8, 2, "w"],
      [8, 8, "w"],
    ],
  ),
  liftedSwap(
    "siamese",
    "Siamese",
    {
      b: "#f1e4c8",
      a: "#5b3d2b",
      d: "#5b3d2b",
      e: "#4fa3d9",
    },
    [
      [2, 7, "d"],
      [2, 10, "d"],
      [3, 7, "d"],
      [3, 8, "d"],
      [3, 9, "d"],
      [3, 10, "d"],
      [4, 8, "d"],
      [4, 10, "d"],
      [8, 2, "d"],
      [8, 8, "d"],
    ],
  ),
  liftedSwap(
    "calico",
    "Calico",
    {
      b: "#fbf7ef",
      a: "#fbf7ef",
      O: "#f0a04b",
      K: "#3a3442",
    },
    [
      [2, 7, "K"],
      [2, 10, "O"],
      [2, 11, "O"],
      [3, 8, "O"],
      [3, 9, "O"],
      [4, 8, "O"],
      [6, 6, "K"],
      [6, 7, "K"],
      [7, 3, "K"],
      [7, 4, "K"],
    ],
  ),
  liftedSwap(
    "greytabby",
    "Grey tabby",
    {
      b: "#a7a2a0",
      a: "#7d7880",
      D: "#5e5a63",
    },
    [
      [2, 11, "D"],
      [3, 8, "D"],
      [5, 6, "D"],
      [6, 8, "D"],
      [7, 4, "D"],
      [7, 6, "D"],
    ],
  ),
];
