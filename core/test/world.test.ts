import { describe, expect, test } from "bun:test";
import { doorOf, MAPS, plotId, townMap } from "../src/maps.ts";
import { doorsFor, setHq } from "../src/office.ts";
import { MAX_PET_LOOKS, PET_VARIANTS, petLooks, wearPet } from "../src/pets.ts";
import { addDays, dayKey, rangeDays } from "../src/range.ts";
import { itemById } from "../src/shop.ts";
import {
  CUP_MS,
  cupsLeft,
  type Drop,
  defaultLook,
  drinkCoffee,
  houseTier,
  LOOK_OPTIONS,
  MAX_CUPS,
  mapOf,
  mentionsIn,
  namesIn,
  outsideDoor,
  parseLook,
  portal,
  RUN_STEP_MS,
  restSpot,
  roomEntry,
  setDrops,
  stepTarget,
  takeStep,
} from "../src/world.ts";

describe("steps", () => {
  const town = townMap([plotId(2, 0)]);

  test("walks onto open ground, not into trees, water or furniture", () => {
    expect(stepTarget(town, 9, 5, "down")).toEqual({ kind: "move", x: 9, y: 6 });
    expect(stepTarget(town, 0, 2, "left").kind).toBe("blocked"); // border tree
    expect(stepTarget(town, 8, 4, "right").kind).toBe("blocked"); // fountain
  });

  test("a door is a portal", () => {
    const [x, y] = doorOf(plotId(2, 0));
    expect(stepTarget(town, x, y + 1, "up")).toEqual({ kind: "portal", ch: "D", x, y });
  });

  test("the step budget allows a short burst, then running pace", () => {
    let budget: number | null = 4;
    let t = 0;
    for (let i = 0; i < 4; i++) budget = takeStep(budget!, t, t);
    expect(budget).toBe(0);
    expect(takeStep(0, t, t + 10)).toBeNull(); // teleport-fast
    t += RUN_STEP_MS;
    expect(takeStep(0, 0, t)).not.toBeNull();
  });
});

describe("coffee", () => {
  test("cups stack, wear off, and top out", () => {
    const now = 1_000_000;
    const one = drinkCoffee(0, now);
    expect(cupsLeft(one, now)).toBe(1);
    expect(cupsLeft(drinkCoffee(one, now), now)).toBe(2);
    expect(cupsLeft(one, now + CUP_MS / 2)).toBe(0.5);
    expect(cupsLeft(one, now + CUP_MS * 2)).toBe(0);
    let until = 0;
    for (let i = 0; i < MAX_CUPS + 3; i++) until = drinkCoffee(until, now);
    expect(cupsLeft(until, now)).toBe(MAX_CUPS);
  });
});

describe("portals", () => {
  const plot = plotId(-1, 1);
  const plots = new Map([[plot, { id: 7, name: "Arox" }]]);
  const [x, y] = doorOf(plot);
  const door = { ch: "D", x, y };
  const exit = { ch: "x", x: 0, y: 0 };

  test("your own house lets you in; others are locked; an empty one says so", () => {
    expect(portal("town", door, 7, plots)).toEqual(roomEntry("hq:7"));
    expect(portal("town", door, 8, plots)).toEqual({ notice: "🔒 Arox's house. Members only." });
    expect("notice" in portal("town", door, 7, new Map())).toBe(true);
  });

  test("leaving a house puts you outside its door; the Inn works for everyone", () => {
    expect(portal("hq:7", exit, 7, plots)).toEqual({ room: "town", x, y: y + 1, facing: "down" });
    expect(portal("town", { ch: "I", x: 13, y: 14 }, null, plots)).toEqual(roomEntry("inn"));
    expect(portal("inn", exit, null, plots)).toEqual(outsideDoor("inn"));
  });

  test("the gate in the square goes down to the raid dungeon, and its exit back up to the gate", () => {
    const [gx, gy] = MAPS.town.find("G")[0]!;
    expect(portal("town", { ch: "G", x: gx, y: gy }, null, plots)).toEqual(roomEntry("dungeon"));
    expect(portal("dungeon", exit, 7, plots)).toEqual({ room: "town", x: gx, y: gy + 1, facing: "down" });
    expect(MAPS.town.walkable(gx, gy + 1)).toBe(true);
  });

  test("bo's door takes you to bo's office; its exit to below the door for a member, or the Inn", () => {
    const doors = doorsFor([
      { userId: 4, name: "ada", open: true },
      { userId: 9, name: "bo", open: true },
    ]);
    const bo = doors[1]!;
    expect(portal("hq:3", { ch: "R", x: bo.x, y: bo.y }, 3, plots, doors)).toEqual(roomEntry("office:9"));
    expect(portal("hq:5", { ch: "R", x: bo.x, y: bo.y }, 3, plots, [])).toEqual({
      notice: "That door isn't yours to open.",
    });
    expect(portal("office:9", exit, 3, plots, doors)).toEqual({
      room: "hq:3",
      x: bo.x,
      y: bo.y + 1,
      facing: "down",
    });
    expect(portal("office:9", exit, 3, plots, [])).toEqual(roomEntry("hq:3")); // no door: the entry
    expect(portal("office:9", exit, null, plots, [])).toEqual(roomEntry("inn"));
  });
});

describe("drops", () => {
  const drop = (id: number, item: string, x: number, y: number, room: Drop["room"] = "inn"): Drop => ({
    id,
    item,
    room,
    x,
    y,
    by: 1,
    at: 0,
  });

  test("dropped furniture is in the room's map, kept until the drops change; a pet isn't", () => {
    setDrops("inn", [drop(1, "furn.s", 2, 6), drop(2, "furn.t", 5, 6), drop(3, "pet.1", 8, 6)]);
    const map = mapOf("inn");
    expect([2, 5, 6, 8].map((x) => map.at(x, 6))).toEqual(["s", "t", "t", "_"]);
    expect(stepTarget(map, 2, 7, "up").kind).toBe("blocked");
    expect(MAPS.inn.at(2, 6)).toBe("_");
    expect(mapOf("inn")).toBe(map);
    setDrops("inn", [drop(3, "pet.1", 8, 6)]);
    expect(mapOf("inn")).toBe(MAPS.inn);
    setDrops("inn", []);
  });

  test("a parcel coming or going keeps the map; furniture makes a new one", () => {
    setDrops("inn", [drop(1, "furn.s", 2, 6)]);
    const map = mapOf("inn");
    setDrops("inn", [drop(1, "furn.s", 2, 6), drop(2, "hat.1", 8, 6)]);
    expect(mapOf("inn")).toBe(map);
    setDrops("inn", [drop(1, "furn.s", 2, 6), drop(2, "hat.1", 8, 6), drop(3, "furn.p", 5, 6)]);
    expect(mapOf("inn")).not.toBe(map);
    expect(mapOf("inn").at(5, 6)).toBe("p");
    setDrops("inn", []);
  });

  test("a room's own map changing shows through, drops and all", () => {
    setDrops("hq:77", [drop(1, "furn.d", 2, 4, "hq:77")]);
    expect(mapOf("hq:77").at(2, 4)).toBe("d");
    setHq(77, doorsFor([{ userId: 1, name: "ada", open: true }]));
    expect([mapOf("hq:77").at(1, -2), mapOf("hq:77").at(2, 4)]).toEqual(["R", "d"]);
    setDrops("hq:77", []);
  });
});

describe("rest spots", () => {
  test("the first free bed, then the floor", () => {
    const beds = MAPS.hq.find("b");
    const first = restSpot("hq:1", "away", new Set());
    expect([first.x, first.y]).toEqual(beds[0]!);
    const taken = new Set(beds.map(([x, y]) => `${x},${y}`));
    const overflow = restSpot("hq:1", "away", taken);
    expect(MAPS.hq.at(overflow.x, overflow.y)).toBe("_");
    expect(overflow.x % 2).toBe(1); // a tile between neighbours
  });

  test("working players get a chair, facing their table", () => {
    const spot = restSpot("inn", "working", new Set());
    expect(MAPS.inn.at(spot.x, spot.y)).toBe("c");
    expect(spot.facing).toBe("up");
  });

  test("the Tavern's overflow sleeps on the floor, never behind the bar", () => {
    const taken = new Set(["b", "c"].flatMap((ch) => MAPS.inn.find(ch).map(([x, y]) => `${x},${y}`)));
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const spot = restSpot("inn", "away", taken);
      const key = `${spot.x},${spot.y}`;
      expect(MAPS.inn.at(spot.x, spot.y)).toBe("_");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      taken.add(key);
    }
  });
});

describe("looks and houses", () => {
  test("default looks are valid and parse round-trips", () => {
    for (let i = 0; i < 50; i++) expect(parseLook(defaultLook(i))).toEqual(defaultLook(i));
    expect(parseLook({ style: 99, skin: 0, hair: 0, outfit: 0 })).toBeNull();
  });

  test("pet variants: old looks parse, out-of-range and petless variants are refused", () => {
    const old = { style: 1, skin: 2, hair: 3, outfit: 4, glasses: 0, hat: 0, pet: 3 };
    expect(parseLook(old)).toEqual({
      ...old,
      held: 0,
      back: 0,
      petwear: 0,
      petVariant: 0,
      merch: 0,
      merchWorn: 0,
    });
    const dog = { ...old, held: 0, back: 0, petwear: 0, petVariant: petLooks(3) - 1, merch: 0, merchWorn: 0 };
    expect(parseLook(dog)).toEqual(dog);
    expect(parseLook({ ...old, petVariant: petLooks(3) })).toBeNull();
    expect(parseLook({ ...old, petVariant: -1 })).toBeNull();
    expect(parseLook({ ...old, petVariant: 1.5 })).toBeNull();
    expect(parseLook({ ...old, pet: 0, petVariant: 1 })).toBeNull();
    // The duck has fewer looks than the dog.
    expect(parseLook({ ...old, pet: 1, petVariant: petLooks(1) })).toBeNull();
    expect(parseLook({ ...old, pet: 1, petVariant: petLooks(1) - 1 })).not.toBeNull();
    expect(LOOK_OPTIONS.petVariant).toBe(MAX_PET_LOOKS);
  });

  test("wearing another pet starts from its original look, so the server never sees an out-of-range one", () => {
    const base = {
      style: 1,
      skin: 2,
      hair: 3,
      outfit: 4,
      glasses: 0,
      hat: 0,
      held: 0,
      back: 0,
      petwear: 0,
      merch: 0,
      merchWorn: 0,
    };
    // A dog in its 12th look, then the shop puts a dragon on: the dog's number would be out of range.
    const dog = { ...base, pet: 3, petVariant: 11 };
    expect(parseLook(wearPet(dog, 4))).toEqual({ ...base, pet: 4, petVariant: 0 });
    expect(parseLook({ ...dog, pet: 4 })).toBeNull();
    // The same pet keeps its look; no pet at all is variant 0.
    expect(wearPet(dog, 3)).toEqual(dog);
    expect(wearPet({ ...base, pet: 0, petVariant: 0 }, 1)).toEqual({ ...base, pet: 1, petVariant: 0 });
  });

  test("houses follow tokens per member, not the team's total", () => {
    expect(houseTier(0, 0)).toBe(0);
    expect(houseTier(2e9, 1)).toBe(2); // one heavy user: a cottage
    expect(houseTier(2e9, 40)).toBe(0); // the same tokens over 40 people: a basement
    expect(houseTier(2e9, 20)).toBe(1); // exactly 100M each: a shack
    expect(houseTier(1e12, 3)).toBe(5);
  });
});

describe("world days", () => {
  test("Copenhagen midnight, across DST", () => {
    expect(dayKey(Date.UTC(2026, 6, 1, 21, 59))).toBe("2026-07-01"); // 23:59 CEST
    expect(dayKey(Date.UTC(2026, 6, 1, 22, 0))).toBe("2026-07-02"); // 00:00 CEST
    expect(dayKey(Date.UTC(2026, 0, 1, 22, 59))).toBe("2026-01-01"); // 23:59 CET
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("ranges are inclusive world days", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    expect(rangeDays("today", now)).toEqual({ from: "2026-09-29", to: "2026-09-29" });
    expect(rangeDays("7d", now)).toEqual({ from: "2026-09-23", to: "2026-09-29" });
    expect(rangeDays("all", now).from).toBeNull();
  });
});

test("mentions in chat need the @; invite fields take names either way", () => {
  expect(mentionsIn("hey @Ada and @bo, not cy")).toEqual(["ada", "bo"]);
  expect(namesIn("@Ada bo, @cy  @ada")).toEqual(["ada", "bo", "cy"]);
  expect(namesIn("  ")).toEqual([]);
});

describe("pet variants", () => {
  test("petLooks counts the original and every variation", () => {
    expect(petLooks(0)).toBe(1);
    expect(petLooks(99)).toBe(1);
    expect(petLooks(1)).toBe(PET_VARIANTS[1]!.length + 1);
    expect(MAX_PET_LOOKS).toBe(Math.max(...Object.values(PET_VARIANTS).map((v) => v.length + 1)));
  });

  test("the ids are unique per pet and only for pets the shop sells", () => {
    for (const [pet, ids] of Object.entries(PET_VARIANTS)) {
      expect(new Set(ids).size).toBe(ids.length);
      expect(itemById(`pet.${pet}`)).toBeDefined();
      for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    }
  });
});
