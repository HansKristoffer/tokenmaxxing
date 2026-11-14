import { expect, test } from "bun:test";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

const { PLAZA, townMap } = await import("../src/render3d/data/town.ts");
const { jettyRunsNorth, surfaceAt } = await import("../src/render3d/town/ground3d.ts");

const map = townMap([]);
const all = (ch: string) => map.find(ch);

test("a tree or a bush in the square stands on its paving, and flowers there are a bed", () => {
  const inRow = ([x, y]: [number, number]) => y === PLAZA.top + 1 && x > PLAZA.left && x < PLAZA.right;
  const planted = [...all("T"), ...all("^")].filter(inRow);
  expect(planted.length).toBeGreaterThanOrEqual(4);
  for (const [x, y] of planted) expect(surfaceAt(map, x, y)).toBe("plaza");
  const beds = all('"').filter(inRow);
  expect(beds.length).toBeGreaterThanOrEqual(2);
  for (const [x, y] of beds) expect(surfaceAt(map, x, y)).toBe("bed");
  // Out on the lawns they are what they were: a tree on grass, a meadow.
  const [mx, my] = all('"').find(([x, y]) => y < PLAZA.top - 1 && map.at(x, y + 1) !== ":")!;
  expect(surfaceAt(map, mx, my)).toBe("flowers");
});

test("the roads along the square are cobbled, the others are not", () => {
  expect(surfaceAt(map, 0, PLAZA.top + 2)).toBe("street");
  expect(surfaceAt(map, PLAZA.right + 1, PLAZA.top + 2)).toBe("street");
  expect(surfaceAt(map, 5, 18)).toBe("path");
  expect(surfaceAt(map, -5, 0)).toBe("path");
});

test("the jetty is the path with the pond on both sides of it, and its boards run out from the bank", () => {
  const jetty: [number, number][] = [];
  for (const [x, y] of all(",")) if (surfaceAt(map, x, y) === "jetty") jetty.push([x, y]);
  expect(jetty.length).toBeGreaterThanOrEqual(1);
  for (const [x, y] of jetty) {
    expect(jettyRunsNorth(map, x, y)).toBe(false);
    expect(map.at(x, y - 1)).toBe("~");
    expect(map.at(x, y + 1)).toBe("~");
    expect(map.walkable(x, y)).toBe(true);
  }
});
