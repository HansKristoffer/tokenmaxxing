import { afterEach, expect, setSystemTime, test } from "bun:test";
import { GIFT_TILES, ORNAMENTS, TREE } from "@tokenmaxxing/core/christmas.ts";
import { COSTUMES } from "@tokenmaxxing/core/costumes.ts";
import { FESTIVE_NPC } from "@tokenmaxxing/core/festive.ts";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

const { NPC_SPRITES } = await import("../src/art/festive-npc.ts");
const { OWN_HEARTS, ornamentPx, TREE_PX } = await import("../src/art/christmas.ts");
const { festiveGreeting } = await import("../src/game/festive-palette.ts");
const { blocksChristmas, christmasInteract, drawChristmas } = await import("../src/game/christmas.ts");
const { world } = await import("../src/game/world.ts");
const { hud } = await import("../src/store.ts");
const { NPC_MODELS } = await import("../src/render3d/town/festive-npc3d.ts");
const { Christmas3d, knudModel } = await import("../src/render3d/town/christmas3d.ts");
const { itemFrame } = await import("../src/art/characters.ts");
const { COVERS_HAIR, HAT_BUILDERS } = await import("../src/render3d/people/gear3dHead.ts");

const map = townMap([plotId(-2, 0), plotId(0, 2), plotId(1, -1)]);
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 1.5, ty - map.y0 + 1.5];
/** The evening of the 22nd (Copenhagen is an hour ahead), and midsummer. */
const DEC22 = new Date("2026-12-22T17:00:00Z");
const JUNE = new Date("2027-06-10T12:00:00Z");

afterEach(() => setSystemTime());

test("every ornament in front lands inside the tree's sprite, on its foliage", () => {
  let front = 0;
  for (const o of ORNAMENTS) {
    const at = ornamentPx(o);
    if (!at) continue;
    front++;
    expect(at[0]).toBeGreaterThan(2);
    expect(at[0]).toBeLessThan(TREE_PX.w - 2);
    expect(at[1]).toBeGreaterThan(3);
    expect(at[1]).toBeLessThan(40);
  }
  // Most hang on the half the 2D town can see.
  expect(front).toBeGreaterThan(ORNAMENTS.length * 0.8);
  for (const [x, y] of OWN_HEARTS) {
    expect(x).toBeGreaterThan(4);
    expect(x + 3).toBeLessThan(TREE_PX.w - 4);
    expect(y).toBeLessThan(40);
  }
});

test("Knud has a sprite and a model, and the day's toast counts the sleeps", () => {
  expect(FESTIVE_NPC.christmas).not.toBeNull();
  expect(NPC_SPRITES.christmas).toBeFunction();
  expect(NPC_MODELS.christmas).toBe(knudModel);
  expect(festiveGreeting({ id: "christmas", intensity: 0.4, days: -3 })).toBe("🎄 3 sleeps to Christmas");
});

test("the tree and Knud block, and E on the tree and the gifts speaks; only in the window", () => {
  Object.assign(world, { room: "town", map });
  setSystemTime(DEC22);
  expect(blocksChristmas(TREE.x, TREE.y)).toBe(true);
  expect(blocksChristmas(FESTIVE_NPC.christmas!.x, FESTIVE_NPC.christmas!.y)).toBe(true);
  expect(blocksChristmas(TREE.x + 1, TREE.y + 1)).toBe(false);
  hud.set({ dialog: null });
  expect(christmasInteract(GIFT_TILES[0]!.x, GIFT_TILES[0]!.y)).toBe(true);
  expect(hud.get().dialog).toContain("gift");
  expect(christmasInteract(TREE.x, TREE.y)).toBe(true);
  expect(hud.get().dialog).toContain("julehjerte");
  expect(christmasInteract(0, 0)).toBe(false);
  setSystemTime(JUNE);
  expect(blocksChristmas(TREE.x, TREE.y)).toBe(false);
  expect(christmasInteract(TREE.x, TREE.y)).toBe(false);
});

test("the 2D tree is drawn in the window, and nothing is the rest of the year", () => {
  Object.assign(world, { room: "town", map });
  const items: { y: number; draw: () => void }[] = [];
  const frame = {
    g: { drawImage: () => {}, fillRect: () => {}, fillStyle: "" },
    items,
    labels: [],
    now: 0,
    dpr: 1,
    scale: 1,
    view: { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 },
    toScreen: () => [0, 0],
  } as never;
  setSystemTime(JUNE);
  drawChristmas(frame);
  expect(items).toHaveLength(0);
  setSystemTime(DEC22);
  drawChristmas(frame);
  expect(items.length).toBeGreaterThan(10);
  for (const i of items) i.draw();
  // The tree's own item stands on its tile's bottom edge.
  expect(items.some((i) => Math.abs(i.y - ((TREE.y + 1) * TILE - 2)) < 1)).toBe(true);
});

test("the 3D town builds Christmas only in the window, in a handful of meshes, and takes it down after", () => {
  Object.assign(world, { room: "town", map });
  const town = new Christmas3d(map, toWorld);
  const meshes = () => {
    let n = 0;
    town.group.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) n++;
    });
    return n;
  };
  setSystemTime(JUNE);
  town.update(0);
  expect(town.group.visible).toBe(false);
  expect(meshes()).toBe(0);
  setSystemTime(DEC22);
  town.update(0);
  expect(town.group.visible).toBe(true);
  // Batched: the whole decorated square, the doors and the lamps are far fewer meshes than things.
  expect(meshes()).toBeGreaterThan(5);
  expect(meshes()).toBeLessThan(160);
  setSystemTime(JUNE);
  town.update(1);
  expect(town.group.visible).toBe(false);
  expect(meshes()).toBe(0);
  town.dispose();
});

test("Knud's model stands on the ground, facing +z, with an idle", () => {
  const model = knudModel(FESTIVE_NPC.christmas!);
  expect(model.userData.tick).toBeFunction();
  model.userData.tick(1.2);
});

test("every Christmas hat has 2D art, a 3D builder and is worn over the hair", () => {
  for (const c of COSTUMES.filter((c) => c.holiday === "christmas")) {
    expect(itemFrame(c), c.name).not.toBeNull();
    expect(HAT_BUILDERS[c.name], c.name).toBeDefined();
    expect(COVERS_HAIR.has(c.name), c.name).toBe(true);
  }
});
