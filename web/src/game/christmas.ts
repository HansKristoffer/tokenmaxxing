/**
 * Christmas in the 2D town (`core/src/christmas.ts` has where everything is; the 3D one is
 * `render3d/town/christmas3d.ts`, and both ask `christmasNow()`): the tree growing ornaments through the days, the
 * gift pile, wreaths and nisser on the doorsteps, candy-cane lamp posts, lights between the square's lamps, snowmen,
 * and the lights' glow after dark. The one thing a player does is hang a julehjerte on the tree, once a day, kept
 * in `localStorage` (a cosmetic that only they see). `?theme=christmas&day=12-22` shows it.
 */
import {
  blocksTile,
  bulbHash,
  type DoorSpot,
  eveOn,
  GARLANDS,
  GIFT_TILES,
  garlandLit,
  giftLine,
  giftsShown,
  type NisseSpot,
  nisseSpots,
  ORNAMENTS,
  ornamentsShown,
  progress,
  SNOWMEN,
  SQUARE_LAMPS,
  snowmenShown,
  starUp,
  TREE,
  wreathSpots,
} from "@tokenmaxxing/core/christmas.ts";
import type { Festive } from "@tokenmaxxing/core/festive.ts";
import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import {
  BULBS,
  candleSprite,
  candyCaneSprite,
  giftSprite,
  julehjerteSprite,
  nisseSprite,
  OWN_HEARTS,
  STAR_AT,
  snowmanSprite,
  TREE_PX,
  treeSprite,
  wreathSprite,
} from "../art/christmas.ts";
import { C } from "../art/palette.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import type { Frame } from "./frame.ts";
import { inView } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { candlesLit } from "./halloween.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** Christmas in play in the town now (the theme is on and we are in the square's room), or null. */
export const christmasNow = (): Festive | null => {
  if (world.room !== "town") return null;
  const f = festiveNow();
  return f?.id === "christmas" ? f : null;
};

// MARK: What the map gives

let spots: { map: GameMap; wreaths: DoorSpot[]; nisser: NisseSpot[] } | null = null;
function placed(): NonNullable<typeof spots> {
  if (spots?.map !== world.map)
    spots = { map: world.map, wreaths: wreathSpots(world.map), nisser: nisseSpots(world.map) };
  return spots;
}

/** The tree's trunk and Knud's tile are not walked through. */
export const blocksChristmas = (x: number, y: number): boolean => christmasNow() !== null && blocksTile(x, y);

/** The map as click-to-walk should see it: the tree and Knud are in the way, so the route goes round them. */
let aware: { map: GameMap; view: GameMap } | null = null;
export function routeMap(map: GameMap): GameMap {
  if (!christmasNow()) return map;
  if (aware?.map !== map)
    aware = {
      map,
      view: new Proxy(map, {
        get(target, key) {
          if (key === "walkable") return (x: number, y: number) => target.walkable(x, y) && !blocksTile(x, y);
          const v = Reflect.get(target, key, target);
          return typeof v === "function" ? v.bind(target) : v;
        },
      }),
    };
  return aware.view;
}

// MARK: The player's own hearts

const HEARTS_KEY = "tokenmaxxing.christmas.hearts";

/** The days (YYYY-MM-DD, world time) the player hung a julehjerte, this year's first. */
function heartDays(): string[] {
  try {
    const v = JSON.parse(storage.getItem(HEARTS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

const today = (): string => {
  const { y, m, d } = worldWall(skyNow());
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** The julehjerter the player has hung this Christmas (this year's window): up to eight, one a day. */
let heartsShown: { year: number; n: number } | null = null;
export const ownHearts = (): number => {
  const year = worldWall(skyNow()).y;
  if (heartsShown?.year !== year)
    heartsShown = {
      year,
      n: Math.min(OWN_HEARTS.length, heartDays().filter((d) => d.startsWith(String(year))).length),
    };
  return heartsShown.n;
};

const NISSE_FRIEND = 3;

/** E on the tree's foot: hangs today's julehjerte, or says come back tomorrow. */
function hangHeart(): void {
  const days = heartDays();
  const t = today();
  if (days.includes(t)) {
    hud.set({
      dialog: `You have already hung today's julehjerte (${ownHearts()} on the tree). Nisse Knud: "Come back tomorrow. A heart a day, not a heart an hour."`,
    });
    return;
  }
  storage.setItem(HEARTS_KEY, JSON.stringify([...days, t].slice(-40)));
  heartsShown = null;
  const n = ownHearts();
  hud.set({
    dialog:
      n === NISSE_FRIEND
        ? `You hang a julehjerte. That is ${n}. Across the square Nisse Knud tips his cap: "One of ours." The star on the tree is sparkling for you now.`
        : `You hang a julehjerte on the tree, red and white and a little crooked. (${n} so far.)`,
  });
}

/** E on the tree's foot or on a gift stack under it. False when it is none of those. */
export function christmasInteract(x: number, y: number): boolean {
  const f = christmasNow();
  if (!f) return false;
  if (x === TREE.x && y === TREE.y) {
    hangHeart();
    return true;
  }
  if (GIFT_TILES.some((g) => g.x === x && g.y === y)) {
    const n = giftsShown(progress(f));
    hud.set({
      dialog:
        n === 0
          ? "The place under the tree is bare. Give it a day or two."
          : `You peek into the pile (${n} gift${n === 1 ? "" : "s"}, and ${8 - n} still to come). ${giftLine(worldWall(skyNow()).d + x)}`,
    });
    return true;
  }
  return false;
}

// MARK: Drawing

/** Whether the star glows for this player: on the eve, or once they have hung three hearts. */
const starSparkles = (f: Festive): boolean => eveOn(f) || ownHearts() >= NISSE_FRIEND;

/** Where the tree sprite's top left is, in world pixels. */
const treeAt = (): [number, number] => [
  TREE.x * TILE + TILE / 2 - TREE_PX.w / 2,
  (TREE.y + 1) * TILE - TREE_PX.h + 1,
];

/** The garlands' bulbs in world pixels: [x, y, index], hanging in a sag between two lamps. */
function bulbsOf(g: { from: number; to: number }): { x: number; y: number; i: number }[] {
  const [ax, ay] = SQUARE_LAMPS[g.from]!;
  const [bx] = SQUARE_LAMPS[g.to]!;
  const x0 = ax * TILE + TILE / 2;
  const x1 = bx * TILE + TILE / 2;
  const y0 = ay * TILE - 11;
  const out: { x: number; y: number; i: number }[] = [];
  const n = Math.floor((x1 - x0) / 6);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push({
      x: Math.round(x0 + (x1 - x0) * t),
      y: Math.round(y0 + 7 * Math.sin(Math.PI * t) + 1),
      i: k + g.from * 40,
    });
  }
  return out;
}

/** Where they are: fixed, so worked out once. */
const BULBS_OF = GARLANDS.map(bulbsOf);
const garlandBulbs = (g: (typeof GARLANDS)[number]) => BULBS_OF[GARLANDS.indexOf(g)]!;

const bulbOn = (i: number, p: number): boolean => bulbHash(i) < garlandLit(p);

export function drawChristmas(f: Frame): void {
  const c = christmasNow();
  if (!c) return;
  const { g, items } = f;
  const p = progress(c);

  // The tree.
  const [tx, ty] = treeAt();
  if (inView(f, tx, ty, TREE_PX.w, TREE_PX.h, TILE)) {
    const s = treeSprite(ornamentsShown(p), starUp(p), ownHearts());
    items.push({ y: (TREE.y + 1) * TILE - 2, draw: () => g.drawImage(s, tx, ty) });
  }

  // The gifts: up to four on each side of the trunk, the stacks growing a box a day.
  const boxes = giftsShown(p);
  const SLOTS: [number, number][] = [
    [4, 8],
    [10, 9],
    [6, 2],
    [12, 3],
  ];
  for (const [side, tile] of GIFT_TILES.entries())
    for (let k = 0; k < SLOTS.length; k++) {
      if (side + k * 2 >= boxes) continue;
      const [sx, sy] = SLOTS[k]!;
      const spr = giftSprite(side + k);
      const px = tile.x * TILE + sx + (side === 0 ? -6 : 4);
      items.push({
        y: (tile.y + 1) * TILE + 1 + k * 0.1,
        draw: () => g.drawImage(spr, px, tile.y * TILE + sy + 3),
      });
    }

  // Snowmen on the lawns.
  for (const m of SNOWMEN.slice(0, snowmenShown(p))) {
    const s = snowmanSprite();
    items.push({
      y: (m.y + 1) * TILE - 1,
      draw: () => g.drawImage(s, m.x * TILE + 3, (m.y + 1) * TILE - s.height - 1),
    });
  }

  const { wreaths, nisser } = placed();
  // Nisser on the doorsteps.
  for (const n of nisser) {
    const s = nisseSprite(n.facing);
    items.push({
      y: (n.y + 1) * TILE - 2,
      draw: () => g.drawImage(s, n.x * TILE + 2, (n.y + 1) * TILE - s.height),
    });
  }
  // Wreaths over the doors, candles on the sills at each side.
  for (const w of wreaths) {
    const s = wreathSprite(w.inn);
    const ox = w.x * TILE + TILE / 2 - Math.floor(s.width / 2);
    const oy = w.y * TILE + 1;
    if (!inView(f, ox - 20, oy, s.width + 40, s.height + 20, TILE)) continue;
    items.push({
      y: (w.y + 1) * TILE + 2,
      draw: () => {
        g.drawImage(s, ox, oy);
        const lit = candlesLit(f.now) || w.x % 2 === 0;
        const candle = candleSprite(lit);
        for (const side of [-1, 1])
          g.drawImage(candle, w.x * TILE + TILE / 2 + side * 14 - 1, w.y * TILE - 6);
      },
    });
  }

  // Candy-cane stripes on the square's four lamp posts.
  for (const [lx, ly] of SQUARE_LAMPS) {
    const s = candyCaneSprite();
    items.push({
      y: ly * TILE + TILE - 1,
      draw: () => g.drawImage(s, lx * TILE + TILE / 2 - 3, ly * TILE - 4),
    });
  }

  // The lights strung between the lamps: a wire, and bulbs lit in the order of the day.
  for (const gar of GARLANDS) {
    const bulbs = garlandBulbs(gar);
    const [, ay] = SQUARE_LAMPS[gar.from]!;
    items.push({
      y: ay * TILE + 8,
      draw: () => {
        g.fillStyle = C.ink;
        for (const b of bulbs) g.fillRect(b.x, b.y, 7, 1);
        for (const [k, b] of bulbs.entries()) {
          const on = bulbOn(b.i, p);
          g.fillStyle = on ? BULBS[k % BULBS.length]! : "#5a4a50";
          g.fillRect(b.x, b.y + 1, 2, 2);
          if (k % 5 === 2) g.drawImage(julehjerteSprite(), b.x - 1, b.y + 2);
        }
      },
    });
  }
}

/** The lights' glow, over the night's tint (`drawLight`), at `strength` (the lamps'). In world space. */
export function lightChristmas(g: CanvasRenderingContext2D, strength: number, now: number): void {
  const c = christmasNow();
  if (!c) return;
  const p = progress(c);
  const [tx, ty] = treeAt();
  // The tree's lights, by the ones that are up.
  for (const [i, o] of ORNAMENTS.slice(0, ornamentsShown(p)).entries()) {
    if (o.set !== "lightsLow" && o.set !== "lightsUp") continue;
    if (Math.cos(o.a) < -0.15) continue;
    const y = Math.round(38 - o.h * 32);
    const x = Math.round(16 + Math.sin(o.a) * (1 + (14 * (y - 4)) / 36) * 0.78);
    drawGlow(
      g,
      tx + x,
      ty + y,
      5,
      ["255,90,90", "255,214,110", "110,230,150", "130,190,255"][o.hue]!,
      strength * 0.32 * flicker(now, i),
    );
  }
  if (starUp(p)) {
    const pulse = 1 + 0.15 * Math.sin(now / 400);
    drawGlow(
      g,
      tx + STAR_AT[0],
      ty + STAR_AT[1],
      starSparkles(c) ? 16 : 10,
      "255,230,140",
      strength * (starSparkles(c) ? 0.8 : 0.45) * pulse,
    );
  }
  for (const gar of GARLANDS)
    for (const [k, b] of garlandBulbs(gar).entries())
      if (bulbOn(b.i, p))
        drawGlow(
          g,
          b.x + 1,
          b.y + 2,
          5,
          ["255,120,110", "255,214,110", "120,230,160", "130,190,255"][k % 4]!,
          strength * 0.4 * flicker(now, b.i),
        );
  // The candles in the windows beside each door, and a warm spill from the wreaths.
  for (const w of placed().wreaths)
    for (const side of [-1, 1])
      drawGlow(
        g,
        w.x * TILE + TILE / 2 + side * 14,
        w.y * TILE - 8,
        6,
        "255,214,110",
        strength * 0.6 * flicker(now, w.x + side),
      );
}
