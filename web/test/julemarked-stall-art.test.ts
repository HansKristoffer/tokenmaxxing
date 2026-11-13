import { expect, test } from "bun:test";
import { STALL_WEARABLES } from "@tokenmaxxing/core/julemarked-shop.ts";
import { CASE_GLASSES, CASE_HATS } from "../src/art/case.ts";
import { STALL_BACKS, STALL_GLASSES, STALL_HATS, STALL_HELD, STALL_OUTFITS } from "../src/art/julemarked-stall-wear.ts";

const of = (slot: string) => STALL_WEARABLES.filter((i) => i.slot === slot);

const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width: number) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row) if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}"`).toBeDefined();
  }
};

test("the stall hat has art on 16 columns, merged into the case hats", () => {
  for (const it of of("hat")) {
    const art = STALL_HATS[it.id];
    expect(art, it.name).toBeDefined();
    expect(CASE_HATS[it.id]).toBe(art!);
    for (const v of ["down", "side", "up"] as const) checkRows(`${it.name} ${v}`, art![v]!, art!.pal, 16);
  }
});

test("the stall outfits have six marks views and the held treats a hand", () => {
  for (const it of of("outfit")) {
    const o = STALL_OUTFITS[it.index];
    expect(o, it.name).toBeDefined();
    for (const v of ["down", "side", "up"] as const) {
      expect(o!.marks[v].length).toBeGreaterThan(0);
      checkRows(`${it.name} ${v}`, o!.marks[v], o!.pal, 16);
    }
  }
  for (const it of of("held")) {
    const h = STALL_HELD[it.index];
    expect(h, it.name).toBeDefined();
    expect(h!.rows.some((r) => r.includes("h")), `${it.name} has a hand`).toBe(true);
    checkRows(it.name, h!.rows, { ...h!.pal, h: "x" }, 9);
  }
});

test("the art is exactly the catalog, and stays at or above STALL_BASE", () => {
  const keys = (t: Record<string, unknown>) => Object.keys(t).sort();
  expect(keys(STALL_HATS)).toEqual(of("hat").map((i) => i.id).sort());
  expect(keys(STALL_OUTFITS)).toEqual(of("outfit").map((i) => String(i.index)).sort());
  expect(keys(STALL_HELD)).toEqual(of("held").map((i) => String(i.index)).sort());
});

test("the stall glasses and back items have art, merged in, on 16 columns", () => {
  for (const it of of("glasses")) {
    const art = STALL_GLASSES[it.id];
    expect(art, it.name).toBeDefined();
    expect(CASE_GLASSES[it.id]).toBe(art!);
    for (const v of ["down", "side"] as const) checkRows(`${it.name} ${v}`, art![v]!, art!.pal, 16);
  }
  for (const it of of("back")) {
    const b = STALL_BACKS[it.index];
    expect(b, it.name).toBeDefined();
    for (const v of ["down", "side", "up"] as const)
      for (const rows of [b!.views[v].behind, b!.views[v].front])
        if (rows) checkRows(`${it.name} ${v}`, rows, b!.pal, 16);
  }
  expect(Object.keys(STALL_GLASSES).sort()).toEqual(of("glasses").map((i) => i.id).sort());
  expect(Object.keys(STALL_BACKS).sort()).toEqual(of("back").map((i) => String(i.index)).sort());
});
