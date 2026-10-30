import { expect, test } from "bun:test";
import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { PETWEAR, petwearRise } from "../src/art/prestige-petwear.ts";
import { geometryDetail, setGeometryDetail } from "../src/render3d/kit/kit.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

test("there is one wear a prestige track, every grid one size and every character in its palette", () => {
  expect(PETWEAR.length).toBe(PRESTIGE_TRACKS.length);
  for (const [r, w] of PETWEAR.entries()) {
    const width = w.frames[0]![0]!.length;
    const height = w.frames[0]!.length;
    for (const [f, rows] of w.frames.entries()) {
      const pal = w.pal(f);
      expect(rows.length, `rank ${r + 1} frame ${f} rows`).toBe(height);
      for (const [y, row] of rows.entries()) {
        expect(row.length, `rank ${r + 1} frame ${f} row ${y}`).toBe(width);
        for (const c of row) if (c !== ".") expect(pal[c], `rank ${r + 1} "${c}"`).toBeDefined();
      }
    }
    expect(w.ms).toBeGreaterThan(0);
  }
  expect(petwearRise(3)).toBeGreaterThan(petwearRise(1));
  expect(petwearRise(2)).toBe(0);
  expect(petwearRise(9)).toBe(0);
});

test("every 3D accessory builds in both detail levels, ticks, and says where it sits", async () => {
  const { petwear3d, PETWEAR_AT } = await import("../src/render3d/pets/prestige-petwear3d.ts");
  const was = geometryDetail();
  try {
    for (const detail of [0, 1] as const) {
      setGeometryDetail(detail);
      for (const rank of [1, 2, 3, 4, 5]) {
        for (const neckR of [0.05, 0.09, 0.16]) {
          const g = petwear3d(rank, neckR);
          let meshes = 0;
          g.traverse((c) => {
            if ((c as { isMesh?: boolean }).isMesh) meshes++;
          });
          expect(meshes, `rank ${rank}`).toBeGreaterThan(2);
          expect(meshes, `rank ${rank} stays small`).toBeLessThan(40);
          expect(g.userData.at).toBe(PETWEAR_AT[rank - 1]!);
          for (const t of [0, 0.7, 12.3]) g.userData.tick(t);
        }
      }
    }
  } finally {
    setGeometryDetail(was);
  }
  expect(petwear3d(0).children.length).toBe(0);
});
