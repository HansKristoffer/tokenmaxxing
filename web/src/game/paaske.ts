/**
 * Påske in the 2D town (`core/src/paaske.ts`; the 3D one is `render3d/town/paaske3d.ts`, and both ask this file what is
 * out and what has been found): the flowers, bunting, the påskeris, the stall and the påskefrokost table, the lambs,
 * bunnies and chicks, the eight eggs hidden in the grass each day, and the chick that follows whoever finds them all.
 * On `skyNow()` and the festive theme (`festiveNow`), so `?theme=paaske&day=04-04` shows it all, build-up and all.
 *
 * What a player has found is theirs alone, in `localStorage`; nothing goes to the server and nothing is for sale.
 */

import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import type { Bunting } from "@tokenmaxxing/core/paaske.ts";
import {
  buntingStrings,
  CRITTERS,
  type Critter,
  critterAt,
  EASTER_TREE,
  EGGS_PER_DAY,
  type Egg,
  eggKey,
  eggSpots,
  type Flower,
  FROKOST,
  flowerSpots,
  isPaaskeSolid,
  STALL,
  shown,
} from "@tokenmaxxing/core/paaske.ts";
import { dayKey, worldWall } from "@tokenmaxxing/core/range.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import {
  buntingSprite,
  critterSprite,
  eggSprite,
  flowerSprite,
  frokostSprite,
  stallSprite,
  TREE_PX,
  treeSprite,
} from "../art/paaske.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import { type Frame, inView } from "./frame.ts";
import { skyNow } from "./sky.ts";
import { self, world } from "./world.ts";

/** The build-up now (0..1) while Påske is on and we are in the town; null otherwise. Both renderers ask. */
export function paaskeNow(): number | null {
  const f = festiveNow();
  return f?.id === "paaske" && world.room === "town" ? f.intensity : null;
}

// MARK: What is where

interface Layout {
  map: GameMap;
  day: string;
  flowers: Flower[];
  eggs: Egg[];
  bunting: Bunting[];
}
let layout: Layout | null = null;

/** The day's scenery in the town: the same for everyone, worked out once per map and world day. */
export function paaskeLayout(): Layout {
  const day = dayKey(skyNow());
  if (layout?.map !== world.map || layout.day !== day)
    layout = {
      map: world.map,
      day,
      flowers: flowerSpots(world.map),
      eggs: eggSpots(world.map, day),
      bunting: buntingStrings(world.map),
    };
  return layout;
}

/** How many flowers, critters etc. of `total` are out at this build-up. */
export const outOf = (total: number, intensity: number): number => shown(total, intensity);

// MARK: The egg hunt

const eggsKey = (day: string) => `paaske-eggs:${day}`;
const chickKey = () => `paaske-chick:${worldWall(skyNow()).y}`;

function read(day: string): Set<string> {
  try {
    return new Set(JSON.parse(storage.getItem(eggsKey(day)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export interface Hunt {
  found: number;
  total: number;
  /** Everything of the day found: the chick follows. */
  done: boolean;
}

const listeners = new Set<() => void>();
/** Calls `fn` whenever an egg is found. Returns the unsubscribe. */
export function onHunt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The eggs found today, from the browser's storage (cached by day). */
let foundCache: { day: string; set: Set<string> } | null = null;
function found(day: string): Set<string> {
  if (foundCache?.day !== day) foundCache = { day, set: read(day) };
  return foundCache.set;
}

/** Eggs still lying in the grass today. */
export function eggsLeft(): Egg[] {
  const l = paaskeLayout();
  const set = found(l.day);
  return l.eggs.filter((e) => !set.has(eggKey(e)));
}

/** Today's count for the HUD, `3 / 8`. */
export function huntNow(): Hunt {
  const l = paaskeLayout();
  const n = l.eggs.filter((e) => found(l.day).has(eggKey(e))).length;
  return { found: n, total: l.eggs.length || EGGS_PER_DAY, done: l.eggs.length > 0 && n >= l.eggs.length };
}

/** Whether the chick is following this player: all of one day's eggs found, any day of this year's Påske. */
export const hasChick = (): boolean => storage.getItem(chickKey()) === "1";

let last = { x: Number.NaN, y: Number.NaN };
/** Called every frame by both renderers: standing on an egg picks it up. */
export function paaskeTick(): void {
  if (paaskeNow() === null) return;
  const me = self();
  if (!me || me.state === "away" || (me.x === last.x && me.y === last.y)) return;
  last = { x: me.x, y: me.y };
  const l = paaskeLayout();
  const egg = l.eggs.find((e) => e.x === me.x && e.y === me.y);
  const set = found(l.day);
  if (!egg || set.has(eggKey(egg))) return;
  set.add(eggKey(egg));
  storage.setItem(eggsKey(l.day), JSON.stringify([...set]));
  const h = huntNow();
  let text = `🥚 A painted egg! ${h.found} / ${h.total} today`;
  if (h.done) {
    storage.setItem(chickKey(), "1");
    text = "🐥 All eight eggs found! A little chick follows you now";
  }
  hud.set({ notice: { text, at: Date.now() } });
  for (const fn of listeners) fn();
}

// MARK: The chick that follows

const chick = { x: Number.NaN, y: Number.NaN, right: true, at: 0 };

/** The follower's place in tiles, moved on to now: null when it is not out. Both renderers ask each frame. */
export function followerNow(now: number): { x: number; y: number; right: boolean; hop: number } | null {
  const me = self();
  if (paaskeNow() === null || !me || !hasChick()) return null;
  const dt = Math.min(0.1, Math.max(0, (now - chick.at) / 1000));
  chick.at = now;
  if (Number.isNaN(chick.x) || Math.hypot(chick.x - me.x, chick.y - me.y) > 8) {
    chick.x = me.x - 1;
    chick.y = me.y;
  }
  const dx = me.x - chick.x;
  const dy = me.y - chick.y;
  const d = Math.hypot(dx, dy);
  let moving = false;
  if (d > 1.4) {
    const step = Math.min(d - 1.2, 4.2 * dt);
    chick.x += (dx / d) * step;
    chick.y += (dy / d) * step;
    moving = true;
    if (Math.abs(dx) > 0.2) chick.right = dx > 0;
  }
  return {
    x: chick.x,
    y: chick.y,
    right: chick.right,
    hop: moving ? Math.abs(Math.sin(now / 70)) : 0,
  };
}

// MARK: Blocking and E

/** Whether Gudrun is on (x, y): the client keeps you off her. */
export const blocksPaaske = (x: number, y: number): boolean => paaskeNow() !== null && isPaaskeSolid(x, y);

/** E on the stall, the tree or the table says what it is. False when it is none of them. */
export function paaskeInteract(x: number, y: number): boolean {
  if (paaskeNow() === null) return false;
  let text = "";
  if (x === STALL.x && y === STALL.y)
    text =
      "Gudrun's trestle: paint pots, a brush, and a dozen eggs drying. Pink, blue and a yellow one with opinions.";
  else if (x === EASTER_TREE.x && y === EASTER_TREE.y)
    text =
      "The påskeris: birch twigs in a blue vase, hung with feathers and painted eggs. Every kitchen has one this week.";
  else if (y === FROKOST.y && x >= FROKOST.x && x < FROKOST.x + FROKOST.w)
    text =
      "Påskefrokost: herring with onion and dill, eggs, rye bread and butter, lamb, and a little snaps. Skål!";
  if (!text) return false;
  hud.set({ dialog: text });
  return true;
}

// MARK: Drawing (2D)

/** A critter's place at `ms`, and its sprite. */
function critterDraw(f: Frame, c: Critter, ms: number): void {
  const p = critterAt(c, ms);
  const s = critterSprite(
    c.kind,
    p.right,
    c.kind === "bunny" || c.kind === "chick" ? (p.hop > 0.5 ? 1 : 0) : 0,
  );
  const lift = c.kind === "lamb" ? p.hop : p.hop * (c.kind === "bunny" ? 4 : 3);
  const px = Math.round(p.x * TILE + (TILE - s.width) / 2);
  const base = Math.round((p.y + 1) * TILE - 2);
  if (!inView(f, px, base - 16, s.width, 20)) return;
  f.items.push({
    y: base,
    draw: () => {
      f.g.fillStyle = "rgba(20, 16, 28, 0.2)";
      f.g.fillRect(px + 1, base - 1, s.width - 2, 2);
      f.g.drawImage(s, px, Math.round(base - s.height - lift + 1));
    },
  });
}

export function drawPaaske(f: Frame): void {
  const intensity = paaskeNow();
  if (intensity === null) return;
  paaskeTick();
  const { g, items } = f;
  const l = paaskeLayout();

  // Flowers: the first clumps on Palm Sunday, all by Easter Sunday noon.
  for (const [i, fl] of l.flowers.slice(0, outOf(l.flowers.length, intensity)).entries()) {
    const x = fl.x * TILE;
    const y = fl.y * TILE + 3;
    if (!inView(f, x, y, TILE, 14, TILE)) continue;
    const s = flowerSprite(fl.kind, i % 5);
    items.push({ y: (fl.y + 1) * TILE - 6, draw: () => g.drawImage(s, x, y) });
  }

  // The hidden eggs, still lying there.
  for (const e of eggsLeft()) {
    const x = e.x * TILE + 4;
    const y = e.y * TILE + 6;
    if (!inView(f, x, y, 7, 8, TILE)) continue;
    const s = eggSprite(e.colour);
    items.push({ y: (e.y + 1) * TILE - 4, draw: () => g.drawImage(s, x, y) });
  }

  // The tree, the stall and the table.
  const tree = treeSprite();
  const tx = EASTER_TREE.x * TILE + Math.floor((TILE - TREE_PX.w) / 2);
  const ty = (EASTER_TREE.y + 1) * TILE - TREE_PX.h - 1;
  if (inView(f, tx, ty, TREE_PX.w, TREE_PX.h))
    items.push({
      y: (EASTER_TREE.y + 1) * TILE - 1,
      draw: () => {
        g.fillStyle = "rgba(20, 16, 28, 0.2)";
        g.fillRect(tx + 6, ty + TREE_PX.h - 3, 12, 3);
        g.drawImage(tree, tx, ty);
      },
    });
  const stall = stallSprite();
  const sx = STALL.x * TILE;
  const sy = STALL.y * TILE;
  if (inView(f, sx, sy, TILE, TILE))
    items.push({ y: (STALL.y + 1) * TILE - 1, draw: () => g.drawImage(stall, sx, sy) });
  const fro = frokostSprite();
  const fx = FROKOST.x * TILE;
  const fy = FROKOST.y * TILE - 2;
  if (inView(f, fx, fy, FROKOST.w * TILE, 18))
    items.push({ y: (FROKOST.y + 1) * TILE - 1, draw: () => g.drawImage(fro, fx, fy) });

  // Bunting between the lamps: the two long sides at once, the short ones from midweek.
  for (const [i, b] of l.bunting.entries()) {
    if (i >= 2 && intensity < 0.45) continue;
    const vertical = b.ax === b.bx;
    const len = vertical ? (b.by - b.ay) * TILE - 6 : (b.bx - b.ax) * TILE - 6;
    const sag = vertical ? 5 : 7;
    const s = buntingSprite(len, sag, vertical);
    const x = b.ax * TILE + (vertical ? 8 : 11);
    const y = b.ay * TILE - (vertical ? 10 : 12);
    if (!inView(f, x, y, s.width, s.height, 4)) continue;
    items.push({ y: vertical ? y + s.height : y + sag + 4, draw: () => g.drawImage(s, x, y) });
  }

  // Lambs, bunnies and chicks.
  for (const c of CRITTERS.slice(0, outOf(CRITTERS.length, intensity))) critterDraw(f, c, skyNow());

  // The chick that follows.
  const fol = followerNow(f.now);
  if (fol) {
    const s = critterSprite("chick", fol.right, fol.hop > 0.5 ? 1 : 0);
    const px = Math.round(fol.x * TILE + (TILE - s.width) / 2);
    const base = Math.round((fol.y + 1) * TILE - 2);
    items.push({
      y: base,
      draw: () => {
        g.fillStyle = "rgba(20, 16, 28, 0.2)";
        g.fillRect(px + 1, base - 1, s.width - 2, 2);
        g.drawImage(s, px, Math.round(base - s.height - fol.hop * 3 + 1));
      },
    });
  }
}
