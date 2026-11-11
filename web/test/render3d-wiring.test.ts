import { beforeAll, expect, test } from "bun:test";
import { MAPS, SHOP_BLOCKS } from "@tokenmaxxing/core/maps.ts";
import { withPieces } from "@tokenmaxxing/core/office.ts";
import { SHOP_BODY_CHAR, SHOP_DOOR_CHAR, SHOP_IDS } from "@tokenmaxxing/core/shoprooms.ts";
import { placedIn } from "../src/render3d/furniture/placed.ts";

// A canvas that draws nothing: enough for the kit's painted textures to be "built" without a browser.
const pixels = () => ({ data: new Uint8ClampedArray(1 << 22), width: 1024, height: 1024 });
const ctx = new Proxy(
  {},
  {
    get: (_t, k) => (k === "canvas" ? {} : k === "getImageData" ? pixels : () => ({ addColorStop() {} })),
    set: () => true,
  },
);
const fake = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} };
Object.assign(globalThis, {
  document: { createElement: () => ({ ...fake }), body: { append() {} }, addEventListener() {} },
  window: globalThis,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { search: "" },
  navigator: { userAgent: "bun" },
});

type Town = typeof import("../src/render3d/town/town3d.ts");
let town: Town;
beforeAll(async () => {
  town = await import("../src/render3d/town/town3d.ts");
});

test("the 3D town is the core map: each shop's front and door stand where the game's town has them", () => {
  const t = town.buildTown3d([]);
  for (const id of SHOP_IDS) {
    const [bx, by] = SHOP_BLOCKS[id];
    const door = [bx * 10 + 5, by * 9 + 6];
    expect(t.map.at(door[0]!, door[1]!)).toBe(SHOP_DOOR_CHAR[id]);
    expect(t.map.at(door[0]! - 2, door[1]!)).toBe(SHOP_BODY_CHAR);
    const d = t.doors.find((q) => q.id === `shop:${id}`);
    expect(d?.tile).toEqual(door as [number, number]);
  }
  // The 3D map and the game's are one: not a tile differs, but the arcade park (3D only): its door, its path and the lawn.
  const core = MAPS.town;
  const differing = t.map.rows.flatMap((row, y) =>
    [...row].filter((ch, x) => ch !== core.at(x + t.map.x0, y + t.map.y0)),
  );
  expect(differing.every((ch) => ".A,".includes(ch))).toBe(true);
});

test("a company house's furniture is read off the map, a wide piece once", () => {
  const map = withPieces(
    [
      { ch: "Σ", x: 8, y: 4 },
      { ch: "ρ", x: 12, y: 4 },
    ],
    MAPS.hq,
  );
  const placed = placedIn(map);
  expect(placed.filter((p) => p.ch === "Σ")).toEqual([{ ch: "Σ", x: 8, y: 4 }]);
  expect(placed.find((p) => p.ch === "ρ")).toEqual({ ch: "ρ", x: 12, y: 4 });
  // The house's own plan holds none of the company's pieces.
  expect(placedIn(MAPS.hq)).toEqual([]);
});

test("every company house, yard and fence included, stays on its block's lawn", async () => {
  const THREE = await import("three");
  const { companyHouse } = await import("../src/render3d/town/town3d-houses.ts");
  // The town puts a house's origin over its door tile, a quarter tile in: x 5.5 and z 6.25 of the block,
  // whose lawn runs from 1 to 10 across and 1 to 9 down (the roads take the first row and column).
  for (let tier = 0; tier <= 5; tier++) {
    const box = new THREE.Box3().setFromObject(companyHouse(tier, "Nightshift Labs", null));
    expect(box.min.x).toBeGreaterThanOrEqual(1 - 5.5);
    expect(box.max.x).toBeLessThanOrEqual(10 - 5.5);
    expect(box.min.z).toBeGreaterThanOrEqual(1 - 6.25);
    expect(box.max.z).toBeLessThanOrEqual(9 - 6.25);
  }
});

test("personal room desks keep the owner's setup while empty and update when it changes", async () => {
  const { world, applyInfo } = await import("../src/game/world.ts");
  const { DeskSetups } = await import("../src/render3d/rooms/desk-setups.ts");
  const { fleetDesk } = await import("../src/render3d/rooms/hq3d.ts");
  const { Model } = await import("../src/render3d/kit/kit.ts");
  const { disposeObject } = await import("../src/render3d/engine/dispose.ts");
  const saved = { owner: world.owner, avatars: world.avatars, room: world.room };
  const model = new Model();
  try {
    world.room = "office:123";
    world.owner = { id: 123, name: "Owner", tier: 0, desk: 3 };
    world.avatars = new Map();
    const desks = new DeskSetups(
      MAPS.office,
      [{ asset: { id: "office-desk" } as never, x: 4, z: 2, turn: 0, model }],
      [1, 1],
    );
    desks.update(0);
    const expected = fleetDesk(3, 3);
    // Compare geometry counts: the ultrawide has three curved screen segments instead of a laptop lid.
    const count = (m: typeof model) => {
      let n = 0;
      m.traverse(() => n++);
      return n;
    };
    expect(count(model)).toBe(count(expected));
    expect(model.userData.live).toBe(true);
    applyInfo({ id: 123, desk: 0 } as never);
    desks.update(250);
    const laptop = fleetDesk(0, 3);
    expect(count(model)).toBe(count(laptop));
    expect(count(model)).not.toBe(count(expected));
    // Shared rooms still use the sitter or fleet, rather than the personal room owner.
    world.owner = null;
    desks.update(500);
    expect(count(model)).toBe(count(laptop));
    disposeObject(expected);
    disposeObject(laptop);
  } finally {
    disposeObject(model);
    Object.assign(world, saved);
  }
});
