/**
 * The framework's default tile props: the shop's furniture where the 2D legend names the same thing, the
 * town's trees, lamps and benches, and the doors, stairs and gate that carry you between rooms. Anything
 * else is a labelled placeholder (`world.ts`) until a slice registers it. Slices register after this file
 * loads, so theirs win.
 */
import { C } from "../art/palette.ts";
import { assetById } from "./furniture.ts";
import { glow, Model, seeded, tint } from "./kit.ts";
import { bush, flowerBed, grandFountain, parkBench, streetLamp, tree } from "./props.ts";
import { registerTile, type TileBuilder, type TileCtx, WALL_HEIGHT } from "./world.ts";

/** 2D tile character -> the catalogue asset that is the same thing. */
const FURNITURE: Record<string, string> = {
  b: "bed",
  c: "chair",
  s: "sofa",
  d: "desk",
  p: "plant",
  t: "tv",
  k: "shelf",
  o: "coffee",
  ε: "beanbag",
  ρ: "bonsai",
  Φ: "water-cooler",
  ψ: "mini-fridge",
  Ω: "coffee-table",
  χ: "monstera",
  σ: "lava-lamp",
  ξ: "whiteboard",
  Λ: "arc-lamp",
  Ξ: "bookshelf",
  μ: "lounge-chair",
  ν: "record-player",
  δ: "neon-sign",
  Σ: "sofa-chesterfield",
  Π: "vending-machine",
  ζ: "standing-desk",
  φ: "foosball",
  α: "espresso-bar",
  η: "server-rack",
  β: "arcade-cabinet",
  κ: "trophy-case",
  γ: "aquarium",
  θ: "ping-pong",
  ω: "gong",
  Γ: "rubber-duck-statue",
};
for (const [ch, id] of Object.entries(FURNITURE)) {
  const a = assetById.get(id);
  if (a && ch !== "b") registerTile(ch, a);
}
// A bed is one tile in the map but two long in the shop: its foot reaches into the free tile in front.
const bedAsset = assetById.get("bed");
if (bedAsset)
  registerTile("b", () => {
    const m = new Model();
    const bed = bedAsset.build();
    bed.position.z = 0.5;
    m.add(bed);
    return m;
  });

// MARK: Outdoors

registerTile("T", (c) => tree((["round", "oak", "pine"] as const)[(c.x * 7 + c.y * 3) % 3]!, c.x * 31 + c.y, 0.9));
registerTile("^", (c) => bush(c.x * 13 + c.y));
registerTile("L", () => streetLamp(), { face: false });
registerTile("B", () => parkBench());
registerTile('"', (c) => flowerBed(0.9, 0.9, c.x * 17 + c.y), { walk: true });
registerTile(
  "F",
  () => {
    const m = new Model();
    const f = grandFountain();
    f.scale.setScalar(0.54);
    m.add(f);
    return m;
  },
  { block: [2, 2] },
);

/** A house tile: walls and a roof, so a row of them reads as a building. */
const house: TileBuilder = (c) => {
  const m = new Model();
  m.box([1, 1.7, 1], "#efe3c8", [0, 0, 0], 0.02);
  m.box([1.08, 0.14, 1.08], "#c4544b", [0, 1.7, 0], 0.02);
  const rnd = seeded(c.x * 5 + c.y);
  if (rnd() < 0.5) m.plane(0.4, 0.4, glow("#9fd4f5"), [0, 1.0, 0.505]);
  return m;
};
registerTile("H", house);

// MARK: Doors, stairs and the gate

/** A wall tile with a door in its room-facing side. */
function doorTile(c: TileCtx, frame = C.white, leaf = C.woodDark, wallColour = C.wall): Model {
  const m = new Model();
  const inTown = c.room === "town";
  m.box([1, inTown ? 1.7 : WALL_HEIGHT, 1], inTown ? "#efe3c8" : wallColour, [0, 0, 0], 0);
  if (inTown) m.box([1.08, 0.14, 1.08], "#c4544b", [0, 1.7, 0], 0.02);
  m.box([0.86, 1.62, 0.06], frame, [0, 0, 0.5], 0.02);
  m.box([0.7, 1.52, 0.06], leaf, [0, 0, 0.53], 0.02);
  for (const y of [0.15, 0.85]) m.box([0.5, 0.55, 0.02], tint(leaf, 0.12), [0, y, 0.565], 0.015);
  m.ball(0.04, "#e9b73d", [0.25, 0.8, 0.6]);
  return m;
}
for (const ch of ["x", "D", "R", "I"]) registerTile(ch, (c) => doorTile(c), { face: true });

/** Stairs: a dark well in the wall with steps going down (`down`) or up. */
function stairs(down: boolean): TileBuilder {
  return (c) => {
    const m = new Model();
    m.box([1, WALL_HEIGHT, 0.5], C.wall, [0, 0, -0.25], 0);
    m.box([0.9, 1.9, 0.02], "#1c1a22", [0, 0, 0.0], 0);
    for (let i = 0; i < 4; i++) {
      const h = down ? 0.02 : 0.2 + i * 0.28;
      const z = down ? 0.05 + i * 0.12 : -0.05 + i * 0.13;
      const top = down ? 0.12 - i * 0.03 : h;
      m.box([0.84, Math.max(0.04, top), 0.13], down ? tint("#8a7a6a", -i * 0.12) : tint("#b99a73", i * 0.04), [0, 0, z], 0.01);
    }
    m.box([0.84, 0.08, 0.04], down ? "#ff8a80" : "#ffd35c", [0, 1.95, 0.02], 0.01);
    void c;
    return m;
  };
}
registerTile("S", stairs(true));
registerTile("u", stairs(false));

/** The raid dungeon's gate: two stone pillars and a dark arch. */
registerTile(
  "G",
  () => {
    const m = new Model();
    const stone = "#6b6f80";
    for (const s of [-1, 1]) {
      m.box([0.22, 2.1, 0.5], stone, [s * 0.4, 0, 0], 0.03);
      m.box([0.3, 0.14, 0.58], tint(stone, 0.1), [s * 0.4, 2.1, 0], 0.03);
    }
    m.box([1.1, 0.34, 0.5], stone, [0, 1.85, 0], 0.03);
    m.box([0.6, 1.85, 0.06], "#1a1020", [0, 0, 0.0], 0);
    m.box([0.5, 0.06, 0.06], glow("#ff5ac8"), [0, 1.5, 0.2]);
    return m;
  },
  { face: false },
);
