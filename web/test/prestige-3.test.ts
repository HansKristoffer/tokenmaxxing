import { expect, test } from "bun:test";
import { PRESTIGE_BASE, PRESTIGE_ITEMS, PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import type * as THREE from "three";
import { CASE_HATS } from "../src/art/case.ts";
import { Pen } from "../src/art/pixels.ts";
import { PRESTIGE_AURAS, PRESTIGE_BACKS, PRESTIGE_HATS, PRESTIGE_OUTFITS } from "../src/art/prestige.ts";
import { TRACK } from "../src/art/prestige-3.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const INDEX = PRESTIGE_BASE + 2;
const items = PRESTIGE_ITEMS.filter((i) => i.index === INDEX);
const named = (slot: string) => items.find((i) => i.slot === slot)!;

/** Every row is a line of `pal`'s characters (or `.`), exactly `width` wide unless `short`. */
const checkRows = (what: string, rows: readonly string[], pal: Record<string, string>, width = 16) => {
  for (const [y, row] of rows.entries()) {
    expect(row.length, `${what} row ${y} is ${row.length} wide`).toBeLessThanOrEqual(width);
    for (const c of row)
      if (c !== ".") expect(pal[c], `${what} row ${y}: "${c}" is not in the palette`).toBeDefined();
  }
};

/** A pen that only records where it paints, so a draw can be checked against its canvas without one. */
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

test("track 3 is the Voidwalker, with art in all four slots filed at its look index", () => {
  expect(PRESTIGE_TRACKS[2]!.key).toBe("voidwalker");
  expect(items.map((i) => i.slot).sort()).toEqual(["aura", "back", "hat", "outfit"]);
  expect(PRESTIGE_HATS[`hat.${INDEX}`]).toBe(TRACK.hat!);
  expect(CASE_HATS[`hat.${INDEX}`]).toBe(TRACK.hat!);
  expect(PRESTIGE_OUTFITS[INDEX]).toBe(TRACK.outfit!);
  expect(PRESTIGE_BACKS[INDEX]).toBe(TRACK.back!);
  expect(PRESTIGE_AURAS[INDEX]).toBe(TRACK.aura!);
});

test("the hat has all three views on the character's 16 columns, every colour defined", () => {
  const hat = TRACK.hat!;
  for (const view of ["down", "side", "up"] as const) {
    expect(hat[view], view).toBeDefined();
    checkRows(`hat ${view}`, hat[view]!, hat.pal);
    for (const row of hat[view]!) expect(row.length, `hat ${view}`).toBe(16);
  }
});

test("the outfit has three mark views of four full rows, every colour defined", () => {
  const o = TRACK.outfit!;
  for (const k of ["c", "C", "p"] as const) expect(o[k]).toMatch(/^#[0-9a-f]{6}$/);
  for (const view of ["down", "side", "up"] as const) {
    expect(o.marks[view].length, view).toBe(4);
    for (const row of o.marks[view]) expect(row.length, view).toBe(16);
    checkRows(`outfit ${view}`, o.marks[view], o.pal);
  }
});

test("the back item has a view each way, no taller than the frame, every colour defined", () => {
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
  // The back view's walking frame differs, so the mantle moves.
  expect(b.walk?.up?.front).not.toEqual(b.views.up.front);
});

test("the aura draws something on every frame, inside its 28x28 canvas, and moves", () => {
  const sums: number[] = [];
  for (let f = 0; f < 8; f++) {
    const r = recorder(28, 28);
    TRACK.aura!(r.pen, f);
    expect({ f, bad: r.bad }).toEqual({ f, bad: [] });
    expect(r.painted(), `frame ${f}`).toBeGreaterThan(40);
    sums.push(r.painted());
  }
  const log = (f: number) => {
    const seen: string[] = [];
    const g = {
      fillStyle: "",
      fillRect: (x: number, y: number) => void seen.push(`${g.fillStyle}@${x},${y}`),
    };
    TRACK.aura!(new Pen(g as unknown as CanvasRenderingContext2D), f);
    return seen.join("|");
  };
  expect(log(0)).not.toEqual(log(3));
});

test("the 3D builders are registered under their keys: hat, back and aura by name, the outfit by look index", async () => {
  const { HAT_BUILDERS, BACK_BUILDERS, OUTFIT_BUILDERS } = await import("../src/render3d/people/gear3d.ts");
  const { AURA_BUILDERS } = await import("../src/render3d/people/gear3dAura.ts");
  const { COVERS_HAIR } = await import("../src/render3d/people/gear3dHead.ts");
  expect(HAT_BUILDERS[named("hat").name]).toBeTypeOf("function");
  expect(COVERS_HAIR.has(named("hat").name)).toBe(true);
  expect(BACK_BUILDERS[named("back").name]).toBeTypeOf("function");
  expect(AURA_BUILDERS[named("aura").name]).toBeTypeOf("function");
  expect(OUTFIT_BUILDERS[INDEX]).toBeTypeOf("function");
});

test("a character in the set, blocky or smooth, is dressed in more than a bare one, and every animation runs", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const meshes = (o: THREE.Object3D) => {
    let n = 0;
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) n++;
    });
    return n;
  };
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  for (const style of ["voxel", "grown"] as const) {
    const base = meshes(avatarFor(bare, undefined, style).root);
    for (const slot of ["hat", "outfit", "back", "aura"] as const) {
      // The armour and the mantle are cubes on the blocky torso only (`gear3d.ts` skips them on the others).
      if (style !== "voxel" && (slot === "outfit" || slot === "back")) continue;
      const a = avatarFor({ ...bare, [slot]: INDEX }, undefined, style);
      expect(meshes(a.root), `${style} ${slot}`).toBeGreaterThan(base);
      for (const t of [0, 0.7, 1.9, 3.1]) a.update(1 / 30, t);
      a.pose = "walk";
      a.update(1 / 30, 4.5);
      a.dispose();
    }
    // And the whole set at once.
    const all = avatarFor({ ...bare, hat: INDEX, outfit: INDEX, back: INDEX, aura: INDEX }, undefined, style);
    for (const t of [0, 1.3, 2.9]) all.update(1 / 30, t);
    all.dispose();
  }
});

test("the 3D set stays small: the whole set on a blocky character adds a few thousand triangles at most", async () => {
  const { avatarFor } = await import("../src/render3d/people/gear3d.ts");
  const tris = (o: THREE.Object3D) => {
    let n = 0;
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh)
        n += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
    });
    return n;
  };
  const bare = { style: 0, skin: 1, hair: 2, outfit: 1 };
  const base = tris(avatarFor(bare, undefined, "voxel").root);
  const dressed = tris(
    avatarFor({ ...bare, hat: INDEX, outfit: INDEX, back: INDEX, aura: INDEX }, undefined, "voxel").root,
  );
  expect(dressed - base).toBeLessThan(9000);
});
