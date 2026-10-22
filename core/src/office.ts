/**
 * Offices: the furniture you can buy, what it costs, and the doors to them. The template itself is
 * `MAPS.office`, with the other rooms; what's in each office is what its owner dropped there.
 */
import { sortBy } from "hanzio";
import { TROPHIES } from "./loot.ts";
import { GameMap, MAPS } from "./maps.ts";

export interface Piece {
  ch: string;
  name: string;
  price: number;
  /** Tiles wide; 1 unless set. */
  w?: number;
  /** Earned this way, never sold: it stays yours, and goes down only in your own office. */
  earned?: string;
}

/** What an office can hold: furniture from the map legend, drawn as it is everywhere else. Sold as `furn.<ch>`. */
export const FURNITURE: readonly Piece[] = [
  { ch: "=", name: "Rug", price: 10 },
  { ch: "p", name: "Plant", price: 20 },
  { ch: "L", name: "Lamp", price: 25 },
  { ch: "c", name: "Chair", price: 30 },
  { ch: "k", name: "Shelf", price: 40 },
  { ch: "B", name: "Bench", price: 40 },
  { ch: "d", name: "Desk", price: 50 },
  { ch: "o", name: "Coffee machine", price: 60 },
  { ch: "b", name: "Bed", price: 80 },
  { ch: "s", name: "Sofa", price: 100 },
  { ch: "t", name: "TV", price: 120, w: 2 },
  // From sitting out an outage at the picnic (`picnic.ts`).
  { ch: "g", name: "Touched grass", price: 0, w: 2, earned: "Sat on a blanket at an outage picnic" },
];
/**
 * The company building's own furniture: fancier, bought from the company wallet (`buyPiece`), and never in
 * anyone's bag. Greek letters in the map legend, so they can't clash with the rooms' own characters;
 * `art` is its sprite in `web/src/art/furniture-fancy.ts`. Every piece takes one row of tiles: the
 * deeper ones (the rug, the ping-pong table) are drawn reaching back over the row behind.
 */
export const COMPANY_FURNITURE: readonly (Piece & { art: string })[] = [
  { ch: "ε", art: "beanbag", name: "Beanbag", price: 35 },
  { ch: "ρ", art: "bonsai", name: "Bonsai", price: 45 },
  { ch: "Φ", art: "water-cooler", name: "Water cooler", price: 55 },
  { ch: "Δ", art: "rug-persian", name: "Persian rug", price: 60, w: 3 },
  { ch: "ψ", art: "mini-fridge", name: "Retro mini fridge", price: 70 },
  { ch: "Ω", art: "coffee-table", name: "Walnut coffee table", price: 80, w: 2 },
  { ch: "χ", art: "monstera", name: "Big monstera", price: 90 },
  { ch: "τ", art: "globe", name: "Desk globe", price: 90 },
  { ch: "σ", art: "lava-lamp", name: "Lava lamp", price: 100 },
  { ch: "ξ", art: "whiteboard", name: "Whiteboard", price: 110, w: 2 },
  { ch: "Λ", art: "arc-lamp", name: "Arc floor lamp", price: 120 },
  { ch: "Ξ", art: "bookshelf-library", name: "Library bookshelf", price: 140, w: 2 },
  { ch: "μ", art: "lounge-chair", name: "Danish lounge chair", price: 180 },
  { ch: "ν", art: "record-player", name: "Vinyl record player", price: 200 },
  { ch: "δ", art: "neon-sign", name: "Neon sign", price: 220, w: 2 },
  { ch: "Σ", art: "sofa-chesterfield", name: "Chesterfield sofa", price: 240, w: 3 },
  { ch: "Π", art: "vending-machine", name: "Vending machine", price: 240 },
  { ch: "ζ", art: "standing-desk", name: "Standing desk, two screens", price: 260, w: 2 },
  { ch: "ι", art: "plant-wall", name: "Plant wall", price: 300, w: 2 },
  { ch: "φ", art: "foosball", name: "Foosball table", price: 350, w: 2 },
  { ch: "α", art: "espresso-bar", name: "Espresso bar", price: 400, w: 2 },
  { ch: "η", art: "server-rack", name: "Server rack", price: 420 },
  { ch: "β", art: "arcade-cabinet", name: "Arcade cabinet", price: 450 },
  { ch: "κ", art: "trophy-case", name: "Trophy case", price: 500, w: 2 },
  { ch: "γ", art: "aquarium", name: "Aquarium", price: 550, w: 2 },
  { ch: "θ", art: "ping-pong", name: "Ping-pong table", price: 600, w: 3 },
  { ch: "ω", art: "gong", name: "Ship-it gong", price: 750, w: 2 },
  { ch: "λ", art: "chandelier", name: "Crystal chandelier", price: 900, w: 2 },
  { ch: "Γ", art: "rubber-duck-statue", name: "Rubber-duck statue", price: 1000 },
];
/** At most this many drops on an office's floor, or a company building's. */
export const OFFICE_PIECES = 40;
/** Your own office opens at this level. */
export const OFFICE_LEVEL = 10;

/** Every piece an office can hold: the shop's, then the raid's trophies (`loot.ts`), never sold. */
export const PIECES: readonly Piece[] = [...FURNITURE, ...TROPHIES];

const BY_CH = new Map<string, Piece>();
for (const f of [...PIECES, ...COMPANY_FURNITURE]) if (!BY_CH.has(f.ch)) BY_CH.set(f.ch, f);

export const pieceOf = (ch: unknown): Piece | undefined => BY_CH.get(ch as string);

/** One placed piece: its top-left tile. */
interface Placed {
  ch: string;
  x: number;
  y: number;
}

/** What a new office holds: a desk with a chair in front of it. */
export const STARTER_OFFICE: readonly Placed[] = [
  { ch: "d", x: 5, y: 3 },
  { ch: "c", x: 5, y: 4 },
];

/**
 * A map with these pieces written over its floor: a room's dropped furniture (`mapOf`). Only over floor:
 * a wall or door the map gained under a piece stays a wall or door.
 */
export function withPieces(pieces: readonly Placed[], base: GameMap): GameMap {
  const rows = base.rows.map((r) => [...r]);
  for (const p of pieces) {
    const w = pieceOf(p.ch)?.w ?? 1;
    for (let i = 0; i < w; i++)
      if (base.walkable(p.x + i, p.y)) rows[p.y - base.y0]![p.x + i - base.x0] = p.ch;
  }
  return new GameMap(
    base.id,
    base.name,
    rows.map((r) => r.join("")),
    base.x0,
    base.y0,
  );
}

// MARK: Doors

/** A door in a company building: whose office, where, and whether it's open (the client draws a 🔒). */
export interface Door {
  userId: number;
  name: string;
  open: boolean;
  x: number;
  y: number;
}
const DOORS_PER_HALLWAY = 10;
/** The gap up through the walls from the floor (from y = 2) to every hallway: between two doors. */
export const PASSAGE_X = 14;

/**
 * Door slots for these owners (sorted by id): slot n is hallway ⌊n/10⌋, tile 1 + 2·(n mod 10).
 * ponytail: packed, not stored, so when a door goes the later ones move down a slot; store slots if
 * people mind their door moving.
 */
export function doorsFor(owners: readonly Omit<Door, "x" | "y">[]): Door[] {
  return sortBy(owners, "userId").map((o, n) => ({
    ...o,
    x: 1 + 2 * (n % DOORS_PER_HALLWAY),
    y: -3 * Math.floor(n / DOORS_PER_HALLWAY) - 2,
  }));
}

/**
 * The building with a hallway of doors per 10 offices, above today's floor (negative y, like the town),
 * so every tile it had keeps its coordinates. A hallway is a wall top, a wall face with the doors, and a
 * corridor.
 */
export function hqMap(doors: readonly Door[]): GameMap {
  const floor = MAPS.hq;
  const y0 = Math.min(0, ...doors.map((d) => d.y - 1));
  const hall = ["W".repeat(floor.width), "W".repeat(floor.width), `W${"_".repeat(floor.width - 2)}W`];
  const rows = [...Array.from({ length: -y0 }, (_, i) => hall[i % 3]!), ...floor.rows].map((r) => [...r]);
  for (const d of doors) rows[d.y - y0]![d.x] = "R";
  for (let y = y0 + 3; y < 2; y++) rows[y - y0]![PASSAGE_X] = "_";
  return new GameMap(
    "hq",
    floor.name,
    rows.map((r) => r.join("")),
    0,
    y0,
  );
}

/** Each company's building. ponytail: one process holds every building it has seen, like the town. */
export const HQS = new Map<number, GameMap>();

export function setHq(companyId: number, doors: readonly Door[]): GameMap {
  const map = hqMap(doors);
  HQS.set(companyId, map);
  return map;
}

/** The door at (x, y) in a building, if any. */
export const doorAt = (doors: readonly Door[], x: number, y: number): Door | undefined =>
  doors.find((d) => d.x === x && d.y === y);
