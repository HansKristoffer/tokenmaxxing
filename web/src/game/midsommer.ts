/**
 * The Sankt Hans theme's scenery in 2D (`core/src/midsommer.ts`; the 3D town is `render3d/town/midsommer3d.ts`, and
 * both ask the same questions here): Dannebrog poles, picnic blankets, door wreaths, glow-worms over the lawn by
 * the pond and sparks over the bonfire, all more of them as the 23rd comes on. And the small client-side
 * ritual: E on the lit bonfire throws your own little straw heks in, and she flies to Bloksbjerg with a tail of
 * sparks. The first one each year is stamped (a Heksebrænder), in `localStorage` only.
 *
 * `?theme=sanktHans&day=06-23T21:00&sky=2026-06-23T22:00` shows it all, lit.
 */

import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import {
  blanketCount,
  blanketSpots,
  FLIGHT_MS,
  flagCount,
  flagSpots,
  stampKey,
  wormAt,
  wormCount,
  wreathDoors,
} from "@tokenmaxxing/core/midsommer.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { BONFIRE } from "@tokenmaxxing/core/sankthans.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { blanketSprite, FLAG_PX, flagSprite, heksSprite, wreathSprite } from "../art/midsommer.ts";
import { storage } from "../storage.ts";
import { festiveNow } from "./festive.ts";
import type { Frame } from "./frame.ts";
import { drawGlow } from "./glow.ts";
import { bonfireNow } from "./sankthans.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** The Sankt Hans intensity in town now (0.4 to 1), or 0 when the theme is not on there. */
export function midsommerNow(): number {
  if (world.room !== "town") return 0;
  const f = festiveNow();
  return f?.id === "sanktHans" ? f.intensity : 0;
}

interface Spots {
  map: GameMap;
  flags: [number, number][];
  blankets: [number, number][];
  wreaths: [number, number][];
}
let spots: Spots | null = null;
/** Where everything stands in the town, worked out once per map. */
export function spotsNow(): Spots {
  if (spots?.map !== world.map)
    spots = {
      map: world.map,
      flags: flagSpots(world.map),
      blankets: blanketSpots(world.map),
      wreaths: wreathDoors(world.map),
    };
  return spots;
}

/** The fire's heart in world pixels, for sparks, glow and the heks's take-off. */
export const FIRE_PX = (): [number, number] => [
  (BONFIRE.x + BONFIRE.w / 2) * TILE,
  (BONFIRE.y + 1) * TILE - 18,
];

// MARK: The heks

let flight: { at: number } | null = null;
/** How long her flight takes: 9 s, or `?heksms=` (QA on a slow machine). */
const FLIGHT = Number(new URLSearchParams(location.search).get("heksms")) || FLIGHT_MS;
/** `?heksat=0.3` holds her at that point in her flight (QA stills). */
const FROZEN = Number(new URLSearchParams(location.search).get("heksat")) || 0;

/** Where the little heks is `t` (0..1) into her flight, in world pixels: up off the fire, then away south-west. */
export function heksAt(t: number): [number, number] {
  const [fx, fy] = FIRE_PX();
  const ease = t * t * (3 - 2 * t);
  return [fx - ease * 330, fy - Math.sin(Math.min(1, t * 1.3) * Math.PI) * 90 + ease * 110 - ease * 30];
}

/** How far into her flight the heks is, 0..1, or null when none is flying. */
export function heksFlight(): number | null {
  if (!flight) return null;
  if (FROZEN) return FROZEN;
  const t = (Date.now() - flight.at) / FLIGHT;
  if (t >= 1) {
    flight = null;
    return null;
  }
  return t;
}

/**
 * E on the bonfire: when it is lit in the Sankt Hans theme, throws a straw heks in and sends her to Bloksbjerg.
 * Returns what to say, or null to leave the bonfire's own line.
 */
export function sendHeks(state: "pile" | "lit"): string | null {
  const f = festiveNow();
  if (f?.id !== "sanktHans" || state !== "lit") return null;
  if (heksFlight() !== null) return "🧙 She is already on her way to Bloksbjerg. Wave her off!";
  flight = { at: Date.now() };
  const key = stampKey(worldWall(skyNow()).y);
  const first = !storage.getItem(key);
  if (first) storage.setItem(key, "1");
  return first
    ? "🧙🔥 Whoosh! Your little heks flies off to Bloksbjerg with a tail of sparks. Heksebrænder stamp earned for this year. Glædelig Sankt Hans!"
    : "🧙🔥 Whoosh! Off she goes to Bloksbjerg, one more heks for the witches' night. Glædelig Sankt Hans!";
}

// MARK: Drawing

export function drawMidsommer({ g, items, now }: Frame): void {
  const k = midsommerNow();
  if (k === 0) return;
  const s = spotsNow();
  const wave = Math.floor(now / 380) % 2;
  for (const [x, y] of s.flags.slice(0, flagCount(k))) {
    const cloth = flagSprite(wave);
    items.push({
      y: (y + 1) * TILE - 1,
      draw: () => g.drawImage(cloth, x * TILE + (TILE - FLAG_PX.w) / 2, (y + 1) * TILE - FLAG_PX.h),
    });
  }
  const blanket = blanketSprite();
  for (const [x, y] of s.blankets.slice(0, blanketCount(k)))
    items.push({ y: y * TILE, draw: () => g.drawImage(blanket, x * TILE, y * TILE + 1) });
  const wreath = wreathSprite();
  for (const [x, y] of s.wreaths)
    items.push({ y: (y + 1) * TILE + 1, draw: () => g.drawImage(wreath, x * TILE + 2, y * TILE - 10) });
  const t = heksFlight();
  if (t !== null) {
    const [hx, hy] = heksAt(t);
    const sprite = heksSprite(Math.floor(now / 150) % 2);
    items.push({
      y: 1e6,
      draw: () => {
        g.drawImage(sprite, Math.round(hx - 13), Math.round(hy - 8));
      },
    });
  }
}

const SPARK = ["#ffd75e", "#ff9a3c", "#ffe9a0", "#ff6a2a"];

/** Sparks over the lit fire and the tail behind the heks, and the glow-worms: over the night's tint, in world space. */
export function lightMidsommer(g: CanvasRenderingContext2D, strength: number, now: number): void {
  const k = midsommerNow();
  if (k === 0) return;
  const [fx, fy] = FIRE_PX();
  if (bonfireNow() === "lit")
    for (let i = 0; i < 14; i++) {
      const p = (now / 2200 + i / 14) % 1;
      const x = fx + Math.sin(i * 12.9 + p * 5) * (4 + 10 * p);
      const y = fy - 6 - p * 58;
      g.globalAlpha = Math.min(1, (1 - p) * 1.4);
      g.fillStyle = SPARK[i % 4]!;
      g.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  g.globalAlpha = 1;
  const t = heksFlight();
  if (t !== null) {
    for (let i = 0; i < 18; i++) {
      const back = Math.max(0, t - i * 0.012);
      const [x, y] = heksAt(back);
      g.globalAlpha = Math.max(0, 1 - i / 18);
      g.fillStyle = SPARK[i % 4]!;
      const jx = Math.sin(i * 7.1 + now / 90) * 3;
      const jy = Math.cos(i * 5.3 + now / 80) * 3;
      g.fillRect(Math.round(x + 12 + jx), Math.round(y + 2 + jy + i * 0.3), 2, 2);
    }
    g.globalAlpha = 1;
    const [hx, hy] = heksAt(t);
    drawGlow(g, hx + 10, hy + 4, 18, "255,150,60", 0.5);
  }
  // The glow-worms: they blink on and off, brighter as it darkens (a faint show even at dusk).
  const seconds = now / 1000;
  const a = 0.25 + 0.75 * Math.min(1, strength * 1.6);
  for (let i = 0; i < wormCount(k); i++) {
    const [x, y, blink] = wormAt(i, seconds);
    if (blink < 0.05) continue;
    const px = x * TILE;
    const py = y * TILE;
    drawGlow(g, px, py, 7, "190,255,80", blink * a);
    g.fillStyle = `rgba(235,255,150,${Math.min(1, blink * a * 1.5)})`;
    g.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
}
