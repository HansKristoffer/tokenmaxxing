import { expect, test } from "bun:test";
import { JULEMARKED_BASE, JULEMARKED_ITEMS } from "@tokenmaxxing/core/case-julemarked.ts";
import { CASE_GLASSES, CASE_HATS } from "../src/art/case.ts";
import { JULEMARKED_GLASSES, JULEMARKED_HATS, JULEMARKED_WEAR_WALK } from "../src/art/case-julemarked.ts";
import { JULEMARKED_BACKS, JULEMARKED_HELD, JULEMARKED_OUTFITS } from "../src/art/case-julemarked-body.ts";

/** Every row is a line of `pal`'s characters (or `.`), no wider than 16 (the character's frame). */
const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

const julemarked = JULEMARKED_ITEMS;
const of = (slot: string) => julemarked.filter((i) => i.slot === slot);

test("every Julemarked hat and pair of glasses has art, on the character's 16 columns", () => {
  for (const [slot, table] of [
    ["hat", CASE_HATS],
    ["glasses", CASE_GLASSES],
  ] as const)
    for (const it of of(slot)) {
      const art = table[it.id];
      expect(art, `${it.name} (${it.id})`).toBeDefined();
      for (const view of ["down", "side", "up"] as const)
        if (art![view]) checkRows(`${it.name} ${view}`, art![view]!, art!.pal);
    }
  // And nothing beyond the catalog.
  const ids = new Set(julemarked.map((i) => i.id));
  for (const id of [...Object.keys(JULEMARKED_HATS), ...Object.keys(JULEMARKED_GLASSES)])
    expect(ids.has(id), `${id} is in the catalog`).toBe(true);
});

test("every Julemarked outfit, held thing and back item has art, found by its look index", () => {
  for (const it of of("outfit")) {
    const o = JULEMARKED_OUTFITS[it.index];
    expect(o, it.name).toBeDefined();
    for (const view of ["down", "side", "up"] as const) {
      expect(o!.marks[view].length, `${it.name} ${view}`).toBeGreaterThan(0);
      checkRows(`${it.name} ${view}`, o!.marks[view], o!.pal);
    }
  }
  for (const it of of("held")) {
    const h = JULEMARKED_HELD[it.index];
    expect(h, it.name).toBeDefined();
    expect(
      h!.rows.some((r) => r.includes("h")),
      `${it.name} has a hand`,
    ).toBe(true);
    checkRows(it.name, h!.rows, { ...h!.pal, h: "x" }, 9);
  }
  for (const it of of("back")) {
    const b = JULEMARKED_BACKS[it.index];
    expect(b, it.name).toBeDefined();
    for (const view of ["down", "side", "up"] as const) {
      const v = b!.views[view];
      expect(v.behind ?? v.front, `${it.name} ${view}`).toBeDefined();
      for (const rows of [v.behind, v.front, b!.walk?.[view]?.behind, b!.walk?.[view]?.front])
        if (rows) checkRows(`${it.name} ${view}`, rows, b!.pal);
    }
  }
});

test("the ranges stay apart: no Julemarked table reaches below its base", () => {
  for (const table of [JULEMARKED_OUTFITS, JULEMARKED_HELD, JULEMARKED_BACKS])
    for (const k of Object.keys(table)) expect(Number(k)).toBeGreaterThanOrEqual(JULEMARKED_BASE);
  for (const id of [...Object.keys(JULEMARKED_HATS), ...Object.keys(JULEMARKED_GLASSES)])
    expect(Number(id.split(".")[1])).toBeGreaterThanOrEqual(JULEMARKED_BASE);
});

test("every Julemarked wearable's art is exactly its catalog: nothing missing, nothing extra", () => {
  const keys = (t: Record<string, unknown>) => Object.keys(t).sort();
  const ids = (slot: string) =>
    of(slot)
      .map((i) => i.id)
      .sort();
  const idx = (slot: string) =>
    of(slot)
      .map((i) => String(i.index))
      .sort();
  expect(keys(JULEMARKED_HATS)).toEqual(ids("hat"));
  expect(keys(JULEMARKED_GLASSES)).toEqual(ids("glasses"));
  expect(keys(JULEMARKED_OUTFITS)).toEqual(idx("outfit"));
  expect(keys(JULEMARKED_HELD)).toEqual(idx("held"));
  expect(keys(JULEMARKED_BACKS)).toEqual(idx("back"));
});

test("the second walking frames (hats, glasses, outfits, held things) fit their art and palettes", () => {
  const ids = new Set(julemarked.map((i) => i.id));
  for (const [id, w] of Object.entries(JULEMARKED_WEAR_WALK)) {
    expect(ids.has(id), `${id} is in the catalog`).toBe(true);
    for (const view of ["down", "side", "up"] as const)
      if (w[view]) checkRows(`${id} walk ${view}`, w[view]!, w.pal);
  }
  for (const it of of("outfit")) {
    const o = JULEMARKED_OUTFITS[it.index]!;
    for (const view of ["down", "side", "up"] as const) {
      if (o.walk?.[view]) checkRows(`${it.name} walk ${view}`, o.walk[view]!, o.pal);
      if (o.beard) checkRows(`${it.name} beard ${view}`, o.beard[view], o.pal);
      if (o.brows) checkRows(`${it.name} brows ${view}`, o.brows[view], o.pal);
    }
  }
  for (const it of of("held")) {
    const h = JULEMARKED_HELD[it.index]!;
    if (h.walk) {
      expect(h.walk.length, `${it.name} walk has as many rows`).toBe(h.rows.length);
      expect(
        h.walk.findIndex((r) => r.includes("h")),
        `${it.name} walk keeps the hand`,
      ).toBe(h.rows.findIndex((r) => r.includes("h")));
      checkRows(`${it.name} walk`, h.walk, { ...h.pal, h: "x" }, 9);
    }
  }
});
