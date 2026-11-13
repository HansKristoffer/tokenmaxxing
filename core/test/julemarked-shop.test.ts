import { describe, expect, test } from "bun:test";
import { ALL_CASE_ITEMS } from "../src/case.ts";
import { ALL_CASE_PIECES } from "../src/case-furniture.ts";
import { JULEMARKED_BASE } from "../src/case-julemarked.ts";
import { caseOfItem } from "../src/cases.ts";
import { HOME_PIECES, SHOP_HOME_PIECES } from "../src/home.ts";
import { STALL_CHAR, STALLS } from "../src/julemarked.ts";
import {
  JULEPYNT_PIECES,
  SHOP_STALL_IDS,
  STALL_BASE,
  STALL_TABS,
  STALL_WEARABLES,
  stallAt,
  stallOfItem,
} from "../src/julemarked-shop.ts";
import { LEGEND, MAPS } from "../src/maps.ts";
import { COMPANY_FURNITURE, FURNITURE } from "../src/office.ts";
import { ITEMS, itemById } from "../src/shop.ts";
import { defaultLook, parseLook } from "../src/world.ts";

const PRICES: Record<string, number> = {
  "held.900": 30,
  "held.901": 40,
  "held.902": 50,
  "held.903": 60,
  "held.904": 30,
  "hat.900": 80,
  "outfit.900": 140,
  "outfit.901": 200,
  "pet.900": 180,
  "pet.901": 240,
  "hat.901": 120,
  "hat.902": 90,
  "glasses.900": 110,
  "glasses.901": 80,
  "outfit.902": 170,
  "outfit.903": 120,
  "back.900": 150,
  "back.901": 140,
  "held.905": 70,
  "held.906": 60,
  "pet.902": 200,
  "pet.903": 220,
  "pet.904": 280,
  "furn.Ѫ": 120,
  "furn.Ѧ": 180,
  "furn.Ѱ": 140,
  "furn.Ѯ": 240,
  "furn.Ѭ": 160,
};

describe("the Julemarked's coin stalls", () => {
  test("twenty-eight items at the agreed prices, all coin-priced, tradeable and never in a case", () => {
    const all = [...STALL_WEARABLES.map((i) => i.id), ...JULEPYNT_PIECES.map((p) => `furn.${p.ch}`)];
    expect(all.sort()).toEqual(Object.keys(PRICES).sort());
    for (const id of all) {
      const i = itemById(id)!;
      expect(i.price).toBe(PRICES[id]!);
      expect(i.tradeable).toBe(true);
      expect(i.case).toBeUndefined();
      expect(i.loot).toBeUndefined();
      expect(i.level).toBeUndefined();
      expect(i.earned).toBeUndefined();
      expect(i.stall).toBe(stallOfItem(id)!);
      expect(caseOfItem(id)).toBeUndefined();
    }
  });

  test("unique ids and names across the whole catalogue; look indices in their own 900 range", () => {
    const stall = ITEMS.filter((i) => i.stall);
    expect(stall).toHaveLength(28);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(new Set(ITEMS.map((i) => i.name.toLowerCase())).size).toBe(ITEMS.length);
    for (const w of STALL_WEARABLES) {
      expect(w.index).toBeGreaterThanOrEqual(STALL_BASE);
      expect(w.index).toBeLessThan(STALL_BASE + 100);
      expect(w.id).toBe(`${w.slot}.${w.index}`);
      expect(w.blurb!.length).toBeGreaterThan(0);
      expect(stallAt(w.slot, w.index)).toBe(w);
    }
    expect(STALL_BASE).toBeGreaterThanOrEqual(JULEMARKED_BASE + 100);
    for (const c of ALL_CASE_ITEMS) expect(c.index < STALL_BASE).toBe(true);
    expect(STALL_WEARABLES.filter((w) => w.slot === "held")).toHaveLength(7);
  });

  test("stalls and slots: godter holds, pynt furnishes, varme wears and keeps pets", () => {
    expect(SHOP_STALL_IDS.map((id) => STALLS.find((s) => s.id === id)!.ch)).toEqual([
      STALL_CHAR.godter,
      STALL_CHAR.pynt,
      STALL_CHAR.varme,
    ]);
    const by = (s: string) => ITEMS.filter((i) => i.stall === s).map((i) => i.slot);
    expect(new Set(by("godter"))).toEqual(new Set(["held"]));
    expect(new Set(by("pynt"))).toEqual(new Set(["furniture"]));
    expect(by("varme").sort()).toEqual(
      [
        "back",
        "back",
        "glasses",
        "glasses",
        "hat",
        "hat",
        "hat",
        "held",
        "held",
        "outfit",
        "outfit",
        "outfit",
        "outfit",
        "pet",
        "pet",
        "pet",
        "pet",
        "pet",
      ].sort() as never,
    );
    for (const id of SHOP_STALL_IDS)
      for (const slot of by(id)) expect(STALL_TABS[id]).toContain(slot as never);
  });

  test("a stall item is worn through parseLook; an unknown index in a stall range is not", () => {
    const look = defaultLook(1);
    for (const w of STALL_WEARABLES) {
      expect(parseLook({ ...look, [w.slot]: w.index })?.[w.slot as "hat"]).toBe(w.index);
    }
    expect(parseLook({ ...look, hat: STALL_BASE + 3 })).toBeNull();
    expect(parseLook({ ...look, held: STALL_BASE + 7 })).toBeNull();
    expect(parseLook({ ...look, pet: STALL_BASE + 5 })).toBeNull();
    expect(parseLook({ ...look, glasses: STALL_BASE + 2 })).toBeNull();
    expect(parseLook({ ...look, back: STALL_BASE + 2 })).toBeNull();
  });

  test("Julepynt's pieces: home furniture on five fresh characters, three on the wall, one tile each", () => {
    expect(JULEPYNT_PIECES.map((p) => p.art)).toEqual([
      "jst-star",
      "jst-kalender",
      "jst-nissedoer",
      "jst-bordtree",
      "jst-gaver",
    ]);
    expect(JULEPYNT_PIECES.map((p) => !!p.wall)).toEqual([true, true, true, false, false]);
    expect(HOME_PIECES).toEqual([...SHOP_HOME_PIECES, ...JULEPYNT_PIECES]);
    const taken = new Set<string>();
    for (const p of [...FURNITURE, ...COMPANY_FURNITURE, ...SHOP_HOME_PIECES, ...ALL_CASE_PIECES])
      taken.add(p.ch);
    for (const m of Object.values(MAPS)) for (const row of m.rows) for (const c of row) taken.add(c);
    for (const ch of Object.keys(LEGEND)) if (!JULEPYNT_PIECES.some((p) => p.ch === ch)) taken.add(ch);
    for (const p of JULEPYNT_PIECES) {
      expect(p).toMatchObject({ w: 1, home: true, stall: "pynt" });
      expect([...p.ch]).toHaveLength(1);
      expect(p.ch.normalize("NFD")).toBe(p.ch);
      expect(taken.has(p.ch)).toBe(false);
      expect(p.text.length).toBeGreaterThan(0);
    }
  });
});
