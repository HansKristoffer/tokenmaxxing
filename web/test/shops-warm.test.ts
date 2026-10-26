import { beforeAll, expect, test } from "bun:test";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();

let shops: typeof import("../src/render3d/shops/catalog.ts");
beforeAll(async () => {
  shops = await import("../src/render3d/shops/catalog.ts");
});

test("the pet shop builds ahead in slices, and walking in then takes what was built", () => {
  let steps = 0;
  while (!shops.warmShop("pets")) steps++;
  expect(steps).toBeGreaterThan(5);
  expect(shops.warmShop("pets")).toBe(true);
  const room = shops.shopRoom("pets");
  expect(room.displays.length).toBeGreaterThan(20);
  expect(shops.shopRoom("pets")).toBe(room);
});

test("a shop with no slices is simply built when it is asked for", () => {
  expect(shops.warmShop("barber")).toBe(true);
});
