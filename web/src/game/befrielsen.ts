/**
 * Befrielsen in 2D (`core/src/befrielsen.ts`): the memorial and flagpoles on the lawns, a candle in every window
 * (lit once the lamps are), and E at the memorial lights one of your own candles (up to four a year: a counter in
 * `localStorage`, nothing on the server). Henning, who tells the story, is the framework's NPC
 * (`game/festive-npc.ts`). The 3D town is `render3d/town/befrielsen3d.ts`; both ask `befrielsenOn` and
 * `memorialCandles`, so the setting and the `?theme=` pin reach them.
 */
import {
  CANDLE_LINES,
  CANDLE_SLOTS,
  CANDLES_FULL,
  FLAGPOLES,
  inMemorial,
  isBefrielsenSolid,
  MAX_MINE,
  MEMORIAL,
  townCandles,
} from "@tokenmaxxing/core/befrielsen.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { DIRS, type Facing, TILE } from "@tokenmaxxing/core/world.ts";
import {
  candleAt,
  FLAG_PX,
  flagpoleSprite,
  MEMORIAL_PX,
  memorialSprite,
  windowCandle,
} from "../art/befrielsen.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import { type Frame, inView } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { candlesLit } from "./halloween.ts";
import { lightsNow, skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** Whether the theme is on and we are in the town (both renderers ask). */
export const befrielsenOn = (): boolean => world.room === "town" && festiveNow()?.id === "befrielsen";

const keyOf = (): string => `befrielsen:candles:${worldWall(skyNow()).y}`;

let mineSeen: { key: string; n: number } | null = null;
/** How many of your own candles burn on the tray this year. */
export function myCandles(): number {
  const key = keyOf();
  if (mineSeen?.key !== key) {
    const n = Number(storage.getItem(key));
    mineSeen = { key, n: Number.isInteger(n) ? Math.min(MAX_MINE, Math.max(0, n)) : 0 };
  }
  return mineSeen.n;
}

/** The candles on the memorial tray now: the town's (growing with the evening) and yours. */
export const memorialCandles = (): { town: number; mine: number } => ({
  town: townCandles(festiveNow()?.intensity ?? 0),
  mine: myCandles(),
});

const left = () => MEMORIAL.x * TILE;
const top = () => (MEMORIAL.y + MEMORIAL.h) * TILE - MEMORIAL_PX.h;

export function drawBefrielsen(f: Frame): void {
  if (!befrielsenOn()) return;
  const { g, items, now } = f;
  const { town, mine } = memorialCandles();
  const [mx, my] = [left(), top()];
  if (inView(f, mx, my, MEMORIAL_PX.w, MEMORIAL_PX.h, TILE)) {
    const sprite = memorialSprite(town, mine);
    items.push({ y: (MEMORIAL.y + MEMORIAL.h) * TILE - 2, draw: () => g.drawImage(sprite, mx, my) });
  }
  const frame = Math.floor(now / 500) % 2;
  for (const { x, y } of FLAGPOLES) {
    const [px, py] = [x * TILE + 2, (y + 1) * TILE - FLAG_PX.h + 1];
    if (!inView(f, px, py, FLAG_PX.w, FLAG_PX.h, TILE)) continue;
    const s = flagpoleSprite(frame);
    items.push({ y: (y + 1) * TILE - 1, draw: () => g.drawImage(s, px, py) });
  }
}

let stamp = Number.NaN;
const lit: { x: number; y: number }[] = [];

/**
 * A candle in each window of a house (called per building by `render.ts`, with its panes in sprite pixels): drawn
 * on the sill, and recorded for the glow. The flame burns once the lamps are on.
 */
export function candleWindows(
  f: Frame,
  panes: readonly { x: number; y: number; w: number; h: number }[],
  at: { left: number; top: number; bottom: number },
): void {
  if (!befrielsenOn()) return;
  if (stamp !== f.now) {
    stamp = f.now;
    lit.length = 0;
  }
  const burning = candlesLit(f.now);
  const flame = windowCandle(burning);
  const dark = windowCandle(false);
  const spots = panes.map((p) => [at.left + p.x + Math.floor(p.w / 2) - 1, at.top + p.y + p.h - 7] as const);
  for (const [x, y] of spots) if (burning) lit.push({ x: x + 1, y: y + 2 });
  f.items.push({
    y: at.bottom - 0.5,
    draw: () => {
      for (const [x, y] of spots) f.g.drawImage(burning ? flame : dark, x, y);
    },
  });
}

/** The candles' glow, over the night's tint (`drawLight`), at `strength` (the lamps'), in world space. */
export function lightBefrielsen(g: CanvasRenderingContext2D, strength: number, now: number): void {
  if (!befrielsenOn()) return;
  for (const [i, c] of lit.entries())
    drawGlow(g, c.x, c.y, 9, "255,196,96", strength * 0.55 * flicker(now, i));
  // The memorial's candles burn by day too, and the ground round them glows as it gets dark.
  const { town, mine } = memorialCandles();
  const [mx, my] = [left(), top()];
  const dark = Math.max(strength, lightsNow(now));
  for (let i = 0; i < CANDLE_SLOTS; i++) {
    if (!(i < town || i >= CANDLE_SLOTS - mine)) continue;
    const [cx, cy] = candleAt(i);
    drawGlow(g, mx + cx + 1, my + cy - 6, 6, "255,190,90", (0.1 + 0.28 * dark) * flicker(now, i + 3));
  }
  drawGlow(g, mx + MEMORIAL_PX.w / 2, my + 40, 30, "255,184,92", 0.05 + 0.16 * dark);
}

/** Whether a step onto (x, y) is blocked by the memorial, a flagpole or Henning. */
export const blocksBefrielsen = (x: number, y: number): boolean => befrielsenOn() && isBefrielsenSolid(x, y);

let line = 0;
/** E on the memorial: lights one of your candles and says who it is for. False when it is not the memorial. */
export function befrielsenInteract(x: number, y: number): boolean {
  if (!befrielsenOn() || !inMemorial(x, y)) return false;
  const n = myCandles();
  if (n >= MAX_MINE) {
    hud.set({ dialog: CANDLES_FULL });
    return true;
  }
  const key = keyOf();
  storage.setItem(key, String(n + 1));
  mineSeen = { key, n: n + 1 };
  hud.set({
    dialog: `${CANDLE_LINES[line++ % CANDLE_LINES.length]} (${n + 1} of your ${MAX_MINE} candles burn here.)`,
  });
  return true;
}

const FACES = Object.keys(DIRS) as Facing[];

/**
 * A click-to-walk route that does not run into the memorial, a flagpole or Henning: `path` (from `route`, which
 * knows only the map) if it is clear, else the shortest way round them. `path` again when there is none.
 */
export function routeAround(
  path: Facing[],
  from: readonly [number, number],
  to: readonly [number, number],
): Facing[] {
  if (!befrielsenOn()) return path;
  let [x, y] = from;
  let blocked = false;
  for (const d of path) {
    x += DIRS[d][0];
    y += DIRS[d][1];
    if (isBefrielsenSolid(x, y) && !(x === to[0] && y === to[1])) blocked = true;
  }
  if (!blocked) return path;
  const key = (a: number, b: number) => `${a},${b}`;
  const came = new Map<string, { from: string; d: Facing }>();
  const queue: [number, number][] = [[from[0], from[1]]];
  const seen = new Set([key(from[0], from[1])]);
  for (let head = 0; head < queue.length; head++) {
    const [cx, cy] = queue[head]!;
    for (const d of FACES) {
      const nx = cx + DIRS[d][0];
      const ny = cy + DIRS[d][1];
      const k = key(nx, ny);
      const goal = nx === to[0] && ny === to[1];
      if (seen.has(k) || !world.map.contains(nx, ny)) continue;
      if (!goal && (!world.map.walkable(nx, ny) || isBefrielsenSolid(nx, ny))) continue;
      seen.add(k);
      came.set(k, { from: key(cx, cy), d });
      if (goal) {
        const out: Facing[] = [];
        for (let at = k; at !== key(from[0], from[1]); ) {
          const c = came.get(at)!;
          out.push(c.d);
          at = c.from;
        }
        return out.reverse();
      }
      queue.push([nx, ny]);
    }
  }
  return path;
}
