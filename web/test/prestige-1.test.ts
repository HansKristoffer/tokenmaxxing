import { expect, test } from "bun:test";
import { PRESTIGE_BASE, PRESTIGE_ITEMS, PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import type * as THREE from "three";
import { CASE_HATS } from "../src/art/case.ts";
import { Pen } from "../src/art/pixels.ts";
import { PRESTIGE_AURAS, PRESTIGE_BACKS, PRESTIGE_HATS, PRESTIGE_OUTFITS } from "../src/art/prestige.ts";
import { TRACK } from "../src/art/prestige-1.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const INDEX = PRESTIGE_BASE + PRESTIGE_TRACKS[0]!.rank - 1;
const mine = PRESTIGE_ITEMS.filter((i) => i.index === INDEX);

/** Every row is a line of `pal`'s characters (or `.`), no wider than `width` (16, the character's frame). */
const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

/** A pen that only records where it paints, so a sprite can be checked against its canvas without one. */
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

const meshes = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) n++;
  });
  return n;
};

test("track I has its four wearables, filed under its look index", () => {
  expect(mine.map((i) => i.slot)).toEqual(["hat", "outfit", "back", "aura"]);
  expect(PRESTIGE_HATS[`hat.${INDEX}`]).toBe(TRACK.hat!);
  expect(CASE_HATS[`hat.${INDEX}`]).toBe(TRACK.hat!);
  expect(PRESTIGE_OUTFITS[INDEX]).toBe(TRACK.outfit!);
  expect(PRESTIGE_BACKS[INDEX]).toBe(TRACK.back!);
  expect(PRESTIGE_AURAS[INDEX]).toBe(TRACK.aura!);
});

test("the visor has all three views on the character's 16 columns, in its palette", () => {
  const hat = TRACK.hat!;
  for (const view of ["down", "side", "up"] as const) {
    expect(hat[view], view).toBeDefined();
    checkRows(`hat ${view}`, hat[view]!, hat.pal);
  }
});

test("the robes have a body, a shade, trousers and marks of the right width in every view", () => {
  const o = TRACK.outfit!;
  for (const c of [o.c, o.C, o.p]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  for (const view of ["down", "side", "up"] as const) {
    expect(o.marks[view].length, view).toBeGreaterThan(0);
    checkRows(`outfit ${view}`, o.marks[view], o.pal);
  }
});

test("the cape has every view, and its walking frames are as wide as the standing ones", () => {
  const b = TRACK.back!;
  for (const view of ["down", "side", "up"] as const) {
    const v = b.views[view];
    expect(v.behind ?? v.front, view).toBeDefined();
    for (const rows of [v.behind, v.front, b.walk?.[view]?.behind, b.walk?.[view]?.front])
      if (rows) {
        expect(rows.length, view).toBeLessThanOrEqual(16);
        checkRows(`back ${view}`, rows, b.pal);
      }
  }
});

test("the aura draws something on every frame, inside its 28x28 canvas, and moves", () => {
  const seen: number[] = [];
  for (let f = 0; f < 8; f++) {
    const r = recorder(28, 28);
    TRACK.aura!(r.pen, f);
    expect({ f, bad: r.bad }).toEqual({ f, bad: [] });
    expect(r.painted(), `frame ${f}`).toBeGreaterThan(15);
    seen.push(r.painted());
  }
  expect(new Set(seen).size).toBeGreaterThan(1);
});

test("every wearable has its 3D builder, under its name or look index", async () => {
  const { HAT_BUILDERS, BACK_BUILDERS, OUTFIT_BUILDERS } = await import("../src/render3d/people/gear3d.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  const { COVERS_HAIR } = await import("../src/render3d/people/gear3dHead.ts");
  for (const item of mine) {
    const where = `${item.slot}: ${item.name}`;
    if (item.slot === "hat") {
      expect(HAT_BUILDERS[item.name], where).toBeTypeOf("function");
      expect(COVERS_HAIR.has(item.name), `${where} covers the hair`).toBe(true);
    }
    if (item.slot === "outfit") expect(OUTFIT_BUILDERS[item.index], where).toBeTypeOf("function");
    if (item.slot === "back") expect(BACK_BUILDERS[item.name], where).toBeTypeOf("function");
    if (item.slot === "aura") expect(AURA_BUILDERS[item.name], where).toBeTypeOf("function");
  }
});

test("a character wearing each piece, blocky or smooth, is dressed in more than a bare one, and animates", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  for (const style of ["voxel", "grown"] as const) {
    const base = meshes(avatarFor(bare, undefined, style).root);
    for (const item of mine) {
      // The outfit and the cape dress the blocky torso only.
      if ((item.slot === "outfit" || item.slot === "back") && style !== "voxel") continue;
      const a = avatarFor({ ...bare, [item.slot]: item.index }, undefined, style);
      expect(meshes(a.root), `${style} ${item.slot}: ${item.name}`).toBeGreaterThan(base);
      for (const t of [0, 0.7, 1.9, 3.1]) a.update(1 / 30, t);
      a.pose = "walk";
      a.update(1 / 30, 4.5);
      a.update(1 / 30, 5.2);
      a.dispose();
    }
  }
});

test("the whole set at once stays light: under a few thousand triangles in either style", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  const all = Object.fromEntries(mine.map((i) => [i.slot, i.index]));
  for (const style of ["voxel", "grown"] as const) {
    const a = avatarFor({ ...bare, ...all }, undefined, style);
    let tris = 0;
    a.root.traverse((c) => {
      const g = (c as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      const n = g?.index?.count ?? g?.getAttribute?.("position")?.count ?? 0;
      tris += n / 3;
    });
    expect(tris, style).toBeLessThan(12000);
    a.dispose();
  }
});
