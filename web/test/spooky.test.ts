import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import { doorSteps } from "@tokenmaxxing/core/halloween.ts";
import { plotId, townMap } from "@tokenmaxxing/core/maps.ts";
import {
  CAULDRON,
  dayKey,
  doorKey,
  GERDA_TILE,
  type Knock,
  STIR_LINES,
  treatAt,
} from "@tokenmaxxing/core/spooky.ts";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";

installHeadlessGlobals();
Object.assign(globalThis.location, { origin: "http://localhost" });
// A storage that keeps what it is given (the headless one forgets).
const kept = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  },
});

// The server's side of a knock (`town/halloween.ts`, tested in the server's tests): a door opens once a day.
// The test says which door it faces (`facing`), as the server works it out from where you stand.
const opened = new Map<string, Set<string>>();
let facing = "";
const real = await import("../src/net.ts");
mock.module("../src/net.ts", () => ({
  ...real,
  conn: {
    knock: async (): Promise<Knock> => {
      const day = dayKey(Date.now());
      const today = opened.get(day) ?? new Set<string>();
      opened.set(day, today);
      const fresh = !today.has(facing);
      today.add(facing);
      return {
        door: facing,
        treat: fresh ? treatAt(facing, day) : null,
        candy: today.size,
        knocked: [...today],
        of: 9,
      };
    },
  },
}));
/** E on a doorstep, and the server's answer. */
const knockAt = async (step: { x: number; y: number; door: readonly [number, number] }): Promise<boolean> => {
  facing = doorKey(step.door);
  const r = spookyInteract(step.x, step.y, "up");
  await Bun.sleep(0);
  return r;
};
const { bucket, blocksSpooky, drawSpooky, spookyInteract, spookyOn } = await import("../src/game/spooky.ts");
const { festiveNpcAt, festiveNpcNow } = await import("../src/game/festive-npc.ts");
const { graphics } = await import("../src/settings/graphics.ts");
const { world } = await import("../src/game/world.ts");
const { hud } = await import("../src/store.ts");
const { storage } = await import("../src/storage.ts");

const NIGHT = new Date("2026-10-31T20:00:00Z");
const NEXT_DAY = new Date("2026-11-01T11:00:00Z");
const JUNE = new Date("2027-06-10T12:00:00Z");
const map = townMap([plotId(-2, 0), plotId(0, 2)]);

beforeEach(() => {
  Object.assign(world, { room: "town", map });
  graphics.override("seasonal", undefined);
  kept.clear();
  hud.set({ dialog: null });
});
afterEach(() => setSystemTime());

const frame = () => {
  const items: { y: number; draw: () => void }[] = [];
  const f = {
    g: new Proxy({}, { get: () => () => {} }),
    items,
    labels: [],
    now: 1000,
    dpr: 1,
    scale: 1,
    view: { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 },
    toScreen: () => [0, 0],
  };
  return { f: f as never, items };
};

test("on the 30th and 31st the spooky layer is on in town, and only then", () => {
  setSystemTime(NIGHT);
  expect(spookyOn()).toBe(true);
  expect(festiveNpcNow()?.name).toContain("Gerda");
  setSystemTime(JUNE);
  expect(spookyOn()).toBe(false);
  expect(festiveNpcNow()).toBeNull();
  setSystemTime(NIGHT);
  Object.assign(world, { room: "inn" });
  expect(spookyOn()).toBe(false);
});

test("the setting turns it off, and Gerda and the cauldron stop blocking", () => {
  setSystemTime(NIGHT);
  expect(blocksSpooky(GERDA_TILE.x, GERDA_TILE.y)).toBe(true);
  expect(blocksSpooky(CAULDRON.x, CAULDRON.y)).toBe(true);
  expect(festiveNpcAt(GERDA_TILE.x, GERDA_TILE.y)).toBe(true);
  graphics.override("seasonal", false);
  expect(spookyOn()).toBe(false);
  expect(blocksSpooky(GERDA_TILE.x, GERDA_TILE.y)).toBe(false);
  expect(festiveNpcAt(GERDA_TILE.x, GERDA_TILE.y)).toBe(false);
});

test("it draws the stones, the cauldron, candy, cobwebs, ghosts and bats, and nothing after the 31st", () => {
  setSystemTime(NIGHT);
  const on = frame();
  drawSpooky(on.f);
  // 4 stones, the cauldron, 12 sweets, a pair of cobwebs per door, 4 ghosts, at least 4 bats.
  expect(on.items.length).toBeGreaterThanOrEqual(4 + 1 + 12 + doorSteps(map).length + 4 + 4);
  setSystemTime(NEXT_DAY);
  const off = frame();
  drawSpooky(off.f);
  expect(off.items).toHaveLength(0);
});

test("knocking: a door gives once a day, the candy counts, a new day opens it again", async () => {
  setSystemTime(NIGHT);
  const steps = doorSteps(map).filter((s) => map.at(s.door[0], s.door[1]) !== "I");
  const door = steps[0]!;
  expect(bucket().doors).toBe(0);
  expect(await knockAt(door)).toBe(true);
  expect(hud.get().dialog).toContain("🎃");
  expect(bucket().doors).toBe(1);
  const candy = bucket().candy;
  hud.set({ dialog: null });
  expect(await knockAt(door)).toBe(true);
  expect(hud.get().dialog).toContain("already");
  expect(bucket().candy).toBe(candy);
  expect(storage.getItem(`halloween:2026-10-31:${doorKey(door.door)}`)).not.toBeNull();
  // The next day (the 1st: not Halloween any more, but the doorstep key moves with the day).
  setSystemTime(new Date("2026-10-30T11:00:00Z"));
  expect(bucket().doors).toBe(0);
  expect(await knockAt(door)).toBe(true);
  expect(hud.get().dialog).not.toContain("already");
});

test("the Tavern's step knocks once, then lets E read its paper", async () => {
  setSystemTime(NIGHT);
  const inn = doorSteps(map).find((s) => map.at(s.door[0], s.door[1]) === "I")!;
  expect(await knockAt(inn)).toBe(true);
  expect(await knockAt(inn)).toBe(false);
});

test("the cauldron answers with a new line each stir; a plain tile with none", () => {
  setSystemTime(NIGHT);
  const seen = new Set<string>();
  for (let i = 0; i < STIR_LINES.length; i++) {
    expect(spookyInteract(CAULDRON.x, CAULDRON.y, "up")).toBe(true);
    seen.add(hud.get().dialog!);
  }
  expect(seen.size).toBe(STIR_LINES.length);
  expect(spookyInteract(0, 0, "up")).toBe(false);
  setSystemTime(JUNE);
  expect(spookyInteract(CAULDRON.x, CAULDRON.y, "up")).toBe(false);
});
