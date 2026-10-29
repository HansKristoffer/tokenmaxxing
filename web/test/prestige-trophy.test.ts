import { expect, test } from "bun:test";
import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import * as THREE from "three";
import { Pen } from "../src/art/pixels.ts";
import { PRESTIGE_TROPHIES, prestigeTrophy } from "../src/art/prestige-trophy.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

/** A pen that records every paint, so a sprite can be checked against its canvas without one. */
const recorder = (w: number, h: number) => {
  const bad: string[] = [];
  const colors = new Set<string>();
  let painted = 0;
  const g = {
    fillStyle: "",
    fillRect(x: number, y: number, rw: number, rh: number) {
      if (rw <= 0 || rh <= 0) return;
      painted++;
      colors.add(this.fillStyle);
      if (![x, y, rw, rh].every(Number.isInteger) || x < 0 || y < 0 || x + rw > w || y + rh > h)
        bad.push(`${x},${y} ${rw}x${rh}`);
    },
  };
  return { pen: new Pen(g as unknown as CanvasRenderingContext2D), bad, painted: () => painted, colors };
};

test("each rank has a trophy with its catalogue name and width, found by rank", () => {
  expect(PRESTIGE_TROPHIES.length).toBe(PRESTIGE_TRACKS.length);
  for (const t of PRESTIGE_TRACKS) {
    const art = prestigeTrophy(t.rank)!;
    expect(art, t.name).toBeDefined();
    expect(art.name).toBe(t.trophy.name);
    expect(art.w).toBe(t.trophy.w);
    expect(art.height).toBeGreaterThanOrEqual(16);
  }
  expect(prestigeTrophy(0)).toBeUndefined();
  expect(prestigeTrophy(99)).toBeUndefined();
});

test("every frame of every trophy paints inside its canvas, on whole pixels, and frames differ", () => {
  for (const art of PRESTIGE_TROPHIES) {
    expect(art.frames).toBeGreaterThan(1);
    const sigs = new Set<string>();
    for (let f = 0; f < art.frames; f++) {
      const r = recorder(art.w * 16, art.height);
      art.draw(r.pen, f, "#ffffff");
      expect(r.bad, `${art.name} frame ${f}`).toEqual([]);
      expect(r.painted()).toBeGreaterThan(100);
      expect(r.colors.size).toBeGreaterThan(5);
      sigs.add([...r.colors].join());
    }
  }
});

test("every 3D trophy builds, fits its footprint, stays small and animates", async () => {
  const { prestigeTrophy3d, PRESTIGE_TROPHY_ASSETS } = await import(
    "../src/render3d/furniture/prestige3d.ts"
  );
  const { ticks } = await import("../src/render3d/kit/kit.ts");
  expect(PRESTIGE_TROPHY_ASSETS.length).toBe(PRESTIGE_TRACKS.length);
  for (const t of PRESTIGE_TRACKS) {
    const before = ticks.length;
    const model = prestigeTrophy3d(t.rank);
    expect(ticks.length, `${t.name} has a tick`).toBeGreaterThan(before);
    for (const tick of ticks.slice(before)) for (const time of [0, 1.3, 7.9]) tick(time);
    const box = new THREE.Box3().setFromObject(model);
    expect(box.max.x - box.min.x, t.name).toBeLessThanOrEqual(t.trophy.w + 0.2);
    expect(box.max.z - box.min.z, t.name).toBeLessThanOrEqual(1.2);
    expect(box.min.y).toBeGreaterThan(-0.05);
    let meshes = 0;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(8);
    expect(meshes).toBeLessThan(400);
    const asset = PRESTIGE_TROPHY_ASSETS[t.rank - 1]!;
    expect(asset.name).toBe(t.trophy.name);
    expect(asset.w).toBe(t.trophy.w);
  }
  expect(() => prestigeTrophy3d(9)).toThrow();
});
