import { expect, test } from "bun:test";
import { PRESTIGE_BASE, PRESTIGE_ITEMS } from "@tokenmaxxing/core/prestige.ts";
import { CASE_HATS } from "../src/art/case.ts";
import { Pen } from "../src/art/pixels.ts";
import { TRACK } from "../src/art/prestige-2.ts";
import { PRESTIGE_AURAS, PRESTIGE_BACKS, PRESTIGE_OUTFITS } from "../src/art/prestige.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const INDEX = PRESTIGE_BASE + 1;
const items = PRESTIGE_ITEMS.filter((i) => i.index === INDEX);
const named = (slot: string) => items.find((i) => i.slot === slot)!;

/** Every row is a line of `pal`'s characters (or `.`), no wider than `width`. */
const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

const recorder = (w: number, h: number) => {
  const bad: string[] = [];
  let painted = 0;
  const g = {
    fillStyle: "",
    fillRect(x: number, y: number, rw: number, rh: number) {
      if (rw <= 0 || rh <= 0) return;
      painted++;
      if (![x, y, rw, rh].every(Number.isInteger) || x < 0 || y < 0 || x + rw > w || y + rh > h)
        bad.push(`${x},${y} ${rw}x${rh}`);
    },
  };
  return { pen: new Pen(g as unknown as CanvasRenderingContext2D), bad, painted: () => painted };
};

test("the Cosmic hat is 16 wide in all three views and filed under its id", () => {
  const hat = CASE_HATS[named("hat").id]!;
  expect(hat).toBe(TRACK.hat!);
  for (const view of ["down", "side", "up"] as const) {
    expect(hat[view], view).toBeDefined();
    checkRows(`hat ${view}`, hat[view]!, hat.pal);
  }
});

test("the Cosmic outfit has three views of marks, all inside its palette", () => {
  const o = PRESTIGE_OUTFITS[INDEX]!;
  expect(o).toBe(TRACK.outfit!);
  for (const view of ["down", "side", "up"] as const) {
    expect(o.marks[view].length).toBeLessThanOrEqual(4);
    checkRows(`outfit ${view}`, o.marks[view], o.pal);
  }
});

test("the Cosmic back item has down, side and up views, and walking frames, inside its palette", () => {
  const b = PRESTIGE_BACKS[INDEX]!;
  expect(b).toBe(TRACK.back!);
  for (const view of ["down", "side", "up"] as const) {
    const v = b.views[view];
    expect(v.behind ?? v.front, view).toBeDefined();
    for (const rows of [v.behind, v.front, b.walk?.[view]?.behind, b.walk?.[view]?.front])
      if (rows) {
        expect(rows.length).toBeLessThanOrEqual(16);
        checkRows(`back ${view}`, rows, b.pal);
      }
  }
});

test("the Cosmic aura draws something on every frame, inside its 28x28 canvas, and loops", () => {
  const draw = PRESTIGE_AURAS[INDEX]!;
  expect(draw).toBe(TRACK.aura!);
  for (let f = 0; f < 8; f++) {
    const r = recorder(28, 28);
    draw(r.pen, f);
    expect({ f, bad: r.bad }).toEqual({ f, bad: [] });
    expect(r.painted(), `frame ${f}`).toBeGreaterThan(15);
  }
});

test("every Cosmic wearable has its 3D builder under the right key", async () => {
  const { HAT_BUILDERS, BACK_BUILDERS, OUTFIT_BUILDERS } = await import("../src/render3d/people/gear3d.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  expect(HAT_BUILDERS[named("hat").name]).toBeTypeOf("function");
  expect(BACK_BUILDERS[named("back").name]).toBeTypeOf("function");
  expect(AURA_BUILDERS[named("aura").name]).toBeTypeOf("function");
  expect(OUTFIT_BUILDERS[INDEX]).toBeTypeOf("function");
});

test("a character in the whole Cosmic set, smooth or blocky, builds and animates", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const look = { style: 0, skin: 1, hair: 2, outfit: INDEX, hat: INDEX, back: INDEX, aura: INDEX };
  for (const style of ["voxel", "grown"] as const) {
    const a = avatarFor(look, undefined, style);
    for (const t of [0, 0.7, 1.9, 3.1]) a.update(1 / 30, t);
    a.pose = "walk";
    a.update(1 / 30, 4.5);
    let meshes = 0;
    a.root.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) meshes++;
    });
    expect(meshes, style).toBeLessThan(900);
    a.dispose();
  }
});
