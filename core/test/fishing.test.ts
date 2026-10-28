import { expect, test } from "bun:test";
import { FISH, fishingPhase, fishingWater, newCast, rollCatch } from "../src/fishing.ts";
import { MAPS } from "../src/maps.ts";

test("only a walkable bank facing town water can cast", () => {
  expect(fishingWater(MAPS.town, 2, 12, "right")).toEqual([3, 12]);
  expect(fishingWater(MAPS.town, 2, 12, "left")).toBeNull();
  expect(fishingWater(MAPS.town, 3, 12, "right")).toBeNull();
  expect(fishingWater(MAPS.inn, 2, 13, "right")).toBeNull();
});

test("a bite has a bounded waiting period and an exact reel window", () => {
  const cast = newCast(2, 13, [3, 13], 1000, () => 0);
  expect(cast.biteAt).toBe(3500);
  expect(fishingPhase(cast, 3499)).toBe("waiting");
  expect(fishingPhase(cast, 3500)).toBe("bite");
  expect(fishingPhase(cast, cast.endsAt - 1)).toBe("bite");
  expect(fishingPhase(cast, cast.endsAt)).toBe("missed");
  expect(newCast(2, 13, [3, 13], 1000, () => 0.99999).biteAt).toBeLessThan(7000);
});

test("every catch is reachable at its advertised weight with lengths within range", () => {
  expect(FISH.reduce((n, f) => n + f.weight, 0)).toBe(100);
  let weight = 0;
  for (const fish of FISH) {
    let draws = 0;
    const caught = rollCatch(() => (draws++ === 0 ? (weight + fish.weight / 2) / 100 : 0.99999));
    expect(caught).toEqual({ fish: fish.id, cm: fish.max });
    weight += fish.weight;
  }
  expect(rollCatch(() => 0)).toEqual({ fish: "perch", cm: 12 });
});
