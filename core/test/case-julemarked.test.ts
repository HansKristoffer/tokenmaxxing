import { describe, expect, test } from "bun:test";
import { ALL_CASE_ITEMS, CASE_BASE, CASE_ITEMS, caseAt } from "../src/case.ts";
import { ALL_CASE_PIECES, CASE_PIECES, casePieceOf } from "../src/case-furniture.ts";
import { JULEMARKED_BASE, JULEMARKED_ITEMS } from "../src/case-julemarked.ts";
import { JULEMARKED_PIECES } from "../src/case-julemarked-furniture.ts";
import { NUSANTARA_ITEMS } from "../src/case-nusantara.ts";
import { RAGNAROK_ITEMS } from "../src/case-ragnarok.ts";
import { CASES, caseById, caseOfItem } from "../src/cases.ts";
import { EDITIONS } from "../src/editions.ts";
import { FISHING_BASE, FISHING_ITEMS } from "../src/fishing-loot.ts";
import { HEADWEAR_ITEMS } from "../src/headwear.ts";
import { HOME_PIECES } from "../src/home.ts";
import { LOOT, TROPHIES } from "../src/loot.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { COMPANY_FURNITURE, FURNITURE, pieceOf } from "../src/office.ts";
import { POSTERS } from "../src/posters.ts";
import { PRESTIGE_BASE, PRESTIGE_ITEMS } from "../src/prestige.ts";
import { RARITIES } from "../src/rarity.ts";
import { canDropIn, ITEMS, isTradeable, itemById } from "../src/shop.ts";
import { WARDROBE } from "../src/wardrobe.ts";
import { defaultLook, parseLook } from "../src/world.ts";

const jul = caseById("julemarked")!;
const night = caseById("night-market")!;

describe("Julemarked wearables", () => {
  test("the pool is 30 wearables: 11 common, 6 uncommon, 5 rare, 4 epic, 4 legendary auras", () => {
    const by = (r: string) => JULEMARKED_ITEMS.filter((i) => i.rarity === r);
    expect(RARITIES.map((r) => by(r).length)).toEqual([11, 6, 5, 4, 4]);
    expect(by("legendary").every((i) => i.slot === "aura")).toBe(true);
    expect(JULEMARKED_ITEMS).toHaveLength(30);
  });

  test("each is new, free, tradeable, a case item, in its own 800 range and in the catalogue", () => {
    const others = [
      ...ITEMS.filter((i) => !i.case),
      ...EDITIONS,
      ...HEADWEAR_ITEMS,
      ...WARDROBE,
      ...LOOT,
      ...CASE_ITEMS,
      ...NUSANTARA_ITEMS,
      ...RAGNAROK_ITEMS,
    ];
    const names = new Set(others.map((i) => i.name.toLowerCase()));
    const ids = new Set(others.map((i) => i.id));
    expect(new Set(JULEMARKED_ITEMS.map((c) => c.id)).size).toBe(JULEMARKED_ITEMS.length);
    expect(new Set(JULEMARKED_ITEMS.map((c) => c.name.toLowerCase())).size).toBe(JULEMARKED_ITEMS.length);
    for (const c of JULEMARKED_ITEMS) {
      expect(names.has(c.name.toLowerCase())).toBe(false);
      expect(ids.has(c.id)).toBe(false);
      expect(c.id).toBe(`${c.slot}.${c.index}`);
      expect(c.index).toBeGreaterThanOrEqual(JULEMARKED_BASE);
      expect(c.index).toBeLessThan(JULEMARKED_BASE + 100);
      expect(c).toMatchObject({ price: 0, tradeable: true, case: true });
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(itemById(c.id)).toBe(c);
    }
  });

  test("a slot's indices run 800, 801, ... with no gaps, and never meet another range", () => {
    const slots = new Set(JULEMARKED_ITEMS.map((c) => c.slot));
    for (const slot of slots) {
      const at = JULEMARKED_ITEMS.filter((c) => c.slot === slot)
        .map((c) => c.index)
        .sort((a, b) => a - b);
      expect(at).toEqual(at.map((_, n) => JULEMARKED_BASE + n));
    }
    // The pond (600s) and the prestige tracks (700s) already own the hundreds below.
    expect(JULEMARKED_BASE).toBeGreaterThan(PRESTIGE_BASE + 99);
    expect(JULEMARKED_BASE).toBeGreaterThan(FISHING_BASE + 99);
    expect(JULEMARKED_BASE).toBeGreaterThan(CASE_BASE + 99);
    expect(ALL_CASE_ITEMS).toHaveLength(
      CASE_ITEMS.length +
        NUSANTARA_ITEMS.length +
        RAGNAROK_ITEMS.length +
        JULEMARKED_ITEMS.length +
        FISHING_ITEMS.length +
        PRESTIGE_ITEMS.length,
    );
    const keys = ALL_CASE_ITEMS.map((c) => `${c.slot}.${c.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("caseAt resolves every Julemarked item, and nothing in between", () => {
    for (const c of JULEMARKED_ITEMS) expect(caseAt(c.slot, c.index)).toBe(c);
    expect(caseAt("aura", 799)).toBeUndefined();
    expect(caseAt("aura", 850)).toBeUndefined();
    expect(caseAt("hat", 1)).toBeUndefined();
  });

  test("the four auras are 800 to 803, and a look can wear every Julemarked slot", () => {
    const auras = JULEMARKED_ITEMS.filter((c) => c.slot === "aura");
    expect(auras.map((a) => [a.name, a.index, a.rarity])).toEqual([
      ["Julestjerne", 800, "legendary"],
      ["Adventskrans", 801, "legendary"],
      ["Snefnug", 802, "legendary"],
      ["Nordlys", 803, "legendary"],
    ]);
    const look = defaultLook(1);
    for (const a of auras) expect(parseLook({ ...look, aura: a.index })?.aura).toBe(a.index);
    expect(parseLook({ ...look, aura: 804 })).toBeNull();
    for (const c of JULEMARKED_ITEMS.filter((i) => i.slot !== "aura")) {
      const worn = parseLook({ ...look, [c.slot]: c.index });
      expect(worn?.[c.slot as "hat"]).toBe(c.index);
    }
    expect(parseLook({ ...look, hat: 804 })).toBeNull();
    expect(parseLook({ ...look, pet: 806 })).toBeNull();
  });
});

describe("Julemarked furniture", () => {
  const others = [
    ...FURNITURE,
    ...COMPANY_FURNITURE,
    ...POSTERS,
    ...TROPHIES,
    ...HOME_PIECES,
    ...CASE_PIECES,
  ];

  test("six pieces on Ъ Є Ђ Ћ Џ Љ that nothing else uses", () => {
    expect(JULEMARKED_PIECES.map((p) => p.ch).join("")).toBe("ЪЄЂЋЏЉ");
    const taken = new Set(others.map((p) => p.ch));
    for (const m of Object.values(MAPS)) for (const row of m.rows) for (const c of row) taken.add(c);
    for (const ch of Object.keys(LEGEND)) if (!ALL_CASE_PIECES.some((p) => p.ch === ch)) taken.add(ch);
    for (const p of ALL_CASE_PIECES.filter((q) => !JULEMARKED_PIECES.includes(q))) taken.add(p.ch);
    for (const p of JULEMARKED_PIECES) {
      expect([...p.ch]).toHaveLength(1);
      expect(p.ch.normalize("NFD")).toBe(p.ch);
      expect(taken.has(p.ch)).toBe(false);
      expect(pieceOf(p.ch)).toBe(p);
      expect(casePieceOf(p.ch)).toBe(p);
    }
    expect(new Set(ALL_CASE_PIECES.map((p) => p.ch)).size).toBe(ALL_CASE_PIECES.length);
  });

  test("names and art ids are unique across every case's pieces, and match no other catalog", () => {
    const names = new Set(others.map((p) => p.name.toLowerCase()));
    expect(new Set(JULEMARKED_PIECES.map((p) => p.name.toLowerCase())).size).toBe(JULEMARKED_PIECES.length);
    const arts = ALL_CASE_PIECES.map((p) => p.art);
    expect(new Set(arts).size).toBe(arts.length);
    for (const p of JULEMARKED_PIECES) {
      expect(p.art.startsWith("jul-")).toBe(true);
      expect(names.has(p.name.toLowerCase())).toBe(false);
      expect(ITEMS.filter((i) => i.id === `furn.${p.ch}`)).toHaveLength(1);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  test("the table: rarity, width, wall and flat hints", () => {
    expect(JULEMARKED_PIECES.map((p) => [p.name, p.art, p.rarity, p.w, !!p.wall, !!p.flat])).toEqual([
      ["Julehjerte-guirlande", "jul-heart-garland", "common", 2, true, false],
      ["Kalenderlys", "jul-kalenderlys", "common", 1, false, false],
      ["Pebernødskål", "jul-pebernod-bowl", "common", 1, false, false],
      ["Adventsstage", "jul-advent", "uncommon", 1, false, false],
      ["Kravlenisse", "jul-kravlenisse", "uncommon", 1, false, false],
      ["Juletræ", "jul-tree", "rare", 3, false, false],
    ]);
  });

  test("every piece is a free, tradeable case item placeable only in its owner's office", () => {
    for (const p of JULEMARKED_PIECES) {
      const item = itemById(`furn.${p.ch}`)!;
      expect(item).toMatchObject({ slot: "furniture", price: 0, tradeable: true, case: true, home: true });
      expect(item.rarity).toBe(p.rarity);
      expect(item.blurb).toBe(p.blurb);
      expect(isTradeable(item.id)).toBe(true);
      expect(canDropIn(item.id, "office:7", 7)).toBe(true);
      expect(canDropIn(item.id, "office:8", 7)).toBe(false);
      expect(canDropIn(item.id, "hq:1", 7)).toBe(false);
    }
  });
});

describe("the Julemarked case", () => {
  test("is the fourth case, tuned like Night Market with a 150 coin key, sold only at the Julemarked", () => {
    expect(CASES.map((c) => c.id)).toEqual(["night-market", "nusantara", "ragnarok-eve", "julemarked"]);
    expect(jul.shop).toBe("julemarked");
    expect(jul.name).toBe("Julemarked case");
    expect(jul.blurb).toBe("Nisser, gløgg, paper hearts and candles from a Danish Christmas market.");
    expect({ k: jul.keyPrice, o: jul.odds, r: jul.rareWithin, d: jul.dupeRerolls }).toEqual({
      k: 150,
      o: night.odds,
      r: night.rareWithin,
      d: night.dupeRerolls,
    });
  });

  test("holds exactly its 30 wearables and 6 pieces, none of another case's", () => {
    expect(jul.items).toHaveLength(36);
    expect(jul.items.every((i) => i.case)).toBe(true);
    const want = new Set([
      ...JULEMARKED_ITEMS.map((i) => i.id),
      ...JULEMARKED_PIECES.map((p) => `furn.${p.ch}`),
    ]);
    expect(new Set(jul.items.map((i) => i.id))).toEqual(want);
    for (const other of CASES.filter((c) => c !== jul)) {
      const ids = new Set(other.items.map((i) => i.id));
      for (const i of jul.items) expect(ids.has(i.id)).toBe(false);
      for (const i of other.items) expect(caseOfItem(i.id)).toBe(other);
    }
    for (const i of jul.items) expect(caseOfItem(i.id)).toBe(jul);
  });

  test("every tier has items, so no roll falls through", () => {
    for (const r of RARITIES) expect(jul.items.some((i) => (i.rarity ?? "common") === r)).toBe(true);
  });
});
