/**
 * What an office's walls and floor can look like. Per owner, not bag items: you buy one once (`purchases`,
 * item `decor.<kind>.<id>`), and then switch between what you own for free. The art is in
 * `web/src/art/tiles.ts`, by id; an id nobody knows is the plain one.
 */
export type DecorKind = "wall" | "floor";

export interface Decor {
  id: string;
  name: string;
  /** Coins; 0 for the plain one and for earned ones. */
  price: number;
  blurb: string;
  /** Earned at this level and never sold: yours from then on. */
  level?: number;
}

export const WALLPAPERS: readonly Decor[] = [
  { id: "plain", name: "Cream panels", price: 0, blurb: "What every office starts with." },
  { id: "hygge", name: "Hygge", price: 40, blurb: "Warm cream and a candle's glow." },
  { id: "nyhavn", name: "Nyhavn", price: 80, blurb: "Stripes in the harbour's colours." },
  { id: "rundetaarn", name: "Rundetårn", price: 120, blurb: "Red brick, like the Round Tower." },
  { id: "jacobsen", name: "Arne Jacobsen", price: 160, blurb: "Flat sage green, nothing more." },
  { id: "skagen", name: "Skagen yellow", price: 60, blurb: "The painters' light, as a warm yellow wash." },
  {
    id: "hammershoi",
    name: "Hammershøi",
    price: 100,
    blurb: "Hushed grey-blue, with pale panels. Nobody is home.",
  },
  {
    id: "terminal",
    name: "Terminal",
    price: 140,
    blurb: "Black, with green text that never stops scrolling.",
  },
  { id: "kanban", name: "Kanban", price: 220, blurb: "A corkboard of sticky notes. Nothing is in Done." },
  { id: "tivoli", name: "Tivoli", price: 0, blurb: "Dark blue with little gold lights.", level: 25 },
];

export const FLOORS: readonly Decor[] = [
  { id: "boards", name: "Boards", price: 0, blurb: "What every office starts with." },
  { id: "linoleum", name: "Linoleum", price: 40, blurb: "Danish mid-century green." },
  { id: "parquet", name: "Parquet", price: 100, blurb: "Herringbone, dark and glossy." },
  { id: "fiskebenet", name: "Fiskebenet", price: 180, blurb: "Pale oak herringbone." },
  { id: "checker", name: "Checker", price: 300, blurb: "Black and white, like a cafe." },
  { id: "terrazzo", name: "Terrazzo", price: 60, blurb: "Speckled stone chips, like a Vesterbro cafe." },
  { id: "klinker", name: "Klinker", price: 90, blurb: "Red-brown clay tiles, like a Danish kitchen." },
  {
    id: "datacentre",
    name: "Server room",
    price: 140,
    blurb: "Perforated raised tiles. Mind the cold aisle.",
  },
  { id: "douglas", name: "Douglas planks", price: 240, blurb: "Wide, pale planks. Dinesen would approve." },
  { id: "bornholm", name: "Bornholm cobble", price: 0, blurb: "Stones from the island.", level: 40 },
];

export const DECORS: Record<DecorKind, readonly Decor[]> = { wall: WALLPAPERS, floor: FLOORS };

export const decorOf = (kind: DecorKind, id: unknown): Decor | undefined =>
  DECORS[kind].find((d) => d.id === id);

/** The plain one of each kind: what no choice means. */
export const isPlain = (kind: DecorKind, id: string | null | undefined): boolean =>
  id == null || id === DECORS[kind][0]!.id || !decorOf(kind, id);

/** The purchase row's item name for a bought one. */
export const decorItem = (kind: DecorKind, id: string): string => `decor.${kind}.${id}`;

export const isDecorKind = (v: unknown): v is DecorKind => v === "wall" || v === "floor";

/** Whether someone at `level` with these purchases (`decorItem` names) may use `d`. */
export const ownsDecor = (kind: DecorKind, d: Decor, level: number, bought: ReadonlySet<string>): boolean =>
  d.price === 0 && d.level === undefined
    ? true
    : d.level !== undefined
      ? level >= d.level
      : bought.has(decorItem(kind, d.id));
