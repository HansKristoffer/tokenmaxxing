import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  PETWEAR,
  petwearRank,
  petwearRise,
  prestigePetwear,
  wornAtNeck,
} from "../src/art/prestige-petwear.ts";
import { petHatRows, petNeck } from "../src/art/wardrobe.ts";

/** A canvas that only has a size. */
const realDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  const g = { fillStyle: "", fillRect() {}, clearRect() {}, drawImage() {} };
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => g }),
  };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

test("the accessory follows the badge: the current run from level 30, else the last finished track", () => {
  expect(petwearRank(undefined)).toBe(0);
  expect(petwearRank({ rank: 0, runLevel: 0 })).toBe(0);
  expect(petwearRank({ rank: 1, runLevel: 29 })).toBe(0);
  expect(petwearRank({ rank: 1, runLevel: 30 })).toBe(1);
  expect(petwearRank({ rank: 3, runLevel: 12 })).toBe(2);
  expect(petwearRank({ rank: 3, runLevel: 50 })).toBe(3);
  expect(petwearRank({ rank: 99, runLevel: 50 })).toBe(0);
});

test("only the collar sits at the neck", () => {
  expect(PETWEAR.map((_, i) => wornAtNeck(i + 1))).toEqual([false, true, false, false, false]);
});

test("the floating ranks rise further than the pet's headroom", () => {
  expect(petwearRise(3)).toBe(7);
  expect(petwearRise(4)).toBe(5);
  expect(petwearRise(0)).toBe(0);
});

test("the collar sits on the species' neck row; others have it fall back", () => {
  expect(petNeck(2, false)).toEqual({ x: 8, y: 6 });
  expect(petNeck(2, true)).toEqual({ x: 8, y: 5 });
  expect(petNeck(6, false)).toBeNull();
  expect(petNeck(0, false)).toBeNull();
});

test("a hat raises the over-the-head wears and not the collar", () => {
  expect(petHatRows(4)).toBe(3);
  expect(petHatRows(1)).toBe(0);
  const flat = prestigePetwear(3, 2, false, false, 0)!;
  const hatted = prestigePetwear(3, 2, false, false, 0, 3)!;
  expect(hatted[2]).toBe(flat[2] - 3);
  expect(prestigePetwear(2, 2, false, false, 0, 3)![2]).toBe(prestigePetwear(2, 2, false, false, 0)![2]);
  expect(prestigePetwear(2, 2, false, false, 0)![2]).toBe(6);
});
