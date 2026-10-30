import { expect, test } from "bun:test";
import { ALL_CASE_PIECES, casePieceOf } from "../src/case-furniture.ts";
import { PRESTIGE_TRACKS } from "../src/prestige.ts";
import {
  isPrestigePiece,
  PRESTIGE_PIECES,
  prestigeTrophyId,
  prestigeTrophyIds,
  trophyItems,
} from "../src/prestige-furniture.ts";
import { canDropIn, isTradeable, itemById } from "../src/shop.ts";

test("every track's trophy is a home piece with its track's name, blurb and footprint", () => {
  expect(PRESTIGE_PIECES).toHaveLength(PRESTIGE_TRACKS.length);
  for (const [i, t] of PRESTIGE_TRACKS.entries()) {
    const p = PRESTIGE_PIECES[i]!;
    expect(p).toMatchObject({
      name: t.trophy.name,
      blurb: t.trophy.blurb,
      w: t.trophy.w,
      art: `prestige-trophy-${t.rank}`,
    });
    expect(casePieceOf(p.ch)).toBe(p);
    expect(ALL_CASE_PIECES).toContain(p);
  }
});

test("ids are stable: the characters never move", () => {
  expect(PRESTIGE_PIECES.map((p) => p.ch).join("")).toBe("ЛПУИЬ");
  expect(PRESTIGE_TRACKS.map((t) => prestigeTrophyId(t.rank))).toEqual(
    ["Л", "П", "У", "И", "Ь"].map((c) => `furn.${c}`),
  );
  expect(prestigeTrophyId(0)).toBeUndefined();
  expect(prestigeTrophyId(PRESTIGE_TRACKS.length + 1)).toBeUndefined();
});

test("a trophy is never sold, never traded, and goes down only in its owner's office", () => {
  for (const p of PRESTIGE_PIECES) {
    const item = itemById(`furn.${p.ch}`)!;
    expect(item).toMatchObject({ slot: "furniture", price: 0, tradeable: false, home: true });
    expect(item.case).toBeUndefined();
    expect(item.earned).toBeDefined();
    expect(isTradeable(item.id)).toBe(false);
    expect(isPrestigePiece(p.ch)).toBe(true);
    expect(canDropIn(item.id, "office:7", 7)).toBe(true);
    expect(canDropIn(item.id, "office:8", 7)).toBe(false);
    expect(canDropIn(item.id, "hq:1", 7)).toBe(false);
  }
});

test("the trophy is granted at run level 50 only", () => {
  expect(prestigeTrophyIds(3)).toEqual([prestigeTrophyId(3)!]);
  expect(trophyItems(3, 49)).toEqual([]);
  expect(trophyItems(3, 50)).toEqual(prestigeTrophyIds(3));
  expect(trophyItems(99, 50)).toEqual([]);
});
