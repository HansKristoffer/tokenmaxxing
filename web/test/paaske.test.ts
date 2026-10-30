import { afterEach, expect, setSystemTime, test } from "bun:test";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import { EGGS_PER_DAY, FARMER_TILE, FROKOST } from "@tokenmaxxing/core/paaske.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
// Some of the 3D modules reach the network client, which reads the page origin on import.
Object.assign(globalThis.location, { origin: "http://localhost" });

// The headless stand-in for localStorage forgets what it is given: keep it.
const kept = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  },
});

const paaske = await import("../src/game/paaske.ts");
const { world } = await import("../src/game/world.ts");
const { hud } = await import("../src/store.ts");
const { storage } = await import("../src/storage.ts");
const { Paaske3d } = await import("../src/render3d/town/paaske3d.ts");
const { gudrun3d } = await import("../src/render3d/town/paaske-npc3d.ts");
const { PAASKE_FARMER } = await import("@tokenmaxxing/core/paaske.ts");
const { NPC_MODELS } = await import("../src/render3d/town/festive-npc3d.ts");
const { NPC_SPRITES } = await import("../src/art/festive-npc.ts");
const { HAT_BUILDERS } = await import("../src/render3d/people/gear3dHead.ts");

/** Easter 2026 is 5 April: the Saturday before, midday, and a day in June. */
const SATURDAY = new Date("2026-04-04T10:00:00Z");
const FRIDAY = new Date("2026-04-03T10:00:00Z");
const JUNE = new Date("2026-06-10T10:00:00Z");
const map = townMap([plotId(-2, 0), plotId(0, 2)]);
const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 3.5, ty - map.y0 + 3.5];

function standAt(x: number, y: number): void {
  world.avatars.set(1, {
    info: { id: 1 },
    x,
    y,
    facing: "down",
    state: "idle",
    from: null,
  } as never);
  Object.assign(world, { room: "town", map, selfId: 1 });
}

afterEach(() => setSystemTime());

test("Påske shows only in its week, in the town", () => {
  standAt(9, 5);
  setSystemTime(SATURDAY);
  expect(paaske.paaskeNow()).toBeGreaterThan(0.5);
  expect(paaske.eggsLeft()).toHaveLength(EGGS_PER_DAY);
  world.room = "inn";
  expect(paaske.paaskeNow()).toBeNull();
  world.room = "town";
  setSystemTime(JUNE);
  expect(paaske.paaskeNow()).toBeNull();
  expect(paaske.blocksPaaske(FARMER_TILE.x, FARMER_TILE.y)).toBe(false);
});

test("Gudrun blocks you; her stall, the table and open grass do not", () => {
  standAt(9, 5);
  setSystemTime(SATURDAY);
  expect(paaske.blocksPaaske(FARMER_TILE.x, FARMER_TILE.y)).toBe(true);
  expect(paaske.blocksPaaske(FROKOST.x + 1, FROKOST.y)).toBe(false);
  expect(paaske.blocksPaaske(FARMER_TILE.x + 1, FARMER_TILE.y)).toBe(false);
});

test("walking over an egg picks it up once, counts it, and the 3D egg goes with it", () => {
  setSystemTime(SATURDAY);
  standAt(9, 5);
  const town = new Paaske3d(map, toWorld);
  town.update(0);
  expect(town.group.visible).toBe(true);
  const shown3d = () => {
    let n = 0;
    town.group.traverse((o) => {
      if (o.visible && o.userData.egg) n++;
    });
    return n;
  };
  const egg = paaske.eggsLeft()[0]!;
  expect(paaske.huntNow()).toEqual({ found: 0, total: EGGS_PER_DAY, done: false });
  standAt(egg.x, egg.y);
  paaske.paaskeTick();
  expect(paaske.huntNow().found).toBe(1);
  expect(paaske.eggsLeft()).toHaveLength(EGGS_PER_DAY - 1);
  expect(hud.get().notice?.text).toContain("1 / 8");
  expect(JSON.parse(storage.getItem("paaske-eggs:2026-04-04")!)).toEqual([`${egg.x},${egg.y}`]);
  // Standing on it again counts nothing more.
  standAt(egg.x, egg.y);
  paaske.paaskeTick();
  expect(paaske.huntNow().found).toBe(1);
  town.update(0);
  expect(shown3d()).toBe(EGGS_PER_DAY - 1);
  // The window ends: the 3D scene goes, geometry and all.
  setSystemTime(JUNE);
  town.update(0);
  expect(town.group.visible).toBe(false);
  expect(town.group.children).toHaveLength(0);
});

test("all eight eggs of a day bring the chick that follows", () => {
  setSystemTime(FRIDAY);
  standAt(9, 5);
  expect(paaske.hasChick()).toBe(false);
  for (const e of paaske.eggsLeft()) {
    standAt(e.x, e.y);
    paaske.paaskeTick();
  }
  expect(paaske.huntNow().done).toBe(true);
  expect(paaske.hasChick()).toBe(true);
  standAt(9, 5);
  const c = paaske.followerNow(1000);
  expect(c).not.toBeNull();
  expect(Math.hypot(c!.x - 9, c!.y - 5)).toBeLessThan(3);
});

test("Gudrun has a 2D sprite and a 3D model registered, and the hats have builders", () => {
  expect(NPC_SPRITES.paaske).toBeDefined();
  expect(NPC_MODELS.paaske).toBe(gudrun3d);
  const root = gudrun3d(PAASKE_FARMER);
  expect(typeof root.userData.tick).toBe("function");
  for (const name of ["Bunny ears", "Chick hat", "Påskelilje crown"])
    expect(HAT_BUILDERS[name], name).toBeDefined();
});
