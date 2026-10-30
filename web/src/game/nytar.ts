/**
 * Nytårsaften in town (30 Dec to 1 Jan, `FESTIVE.nytar`, `core/src/nytar.ts`): the Nytårsur by the square with a sign
 * that counts down to midnight, the buffet with its kransekage tower, the jumping chair, balloons, party lights
 * between the square's lamps, small firework shows every half hour on the evening of the 31st, and confetti. The
 * 3D town draws the same things from the same numbers (`render3d/town/nytar3d.ts`).
 *
 * The hop: Space within three seconds of the stroke of midnight is a hop into the new year. Everyone who hops near
 * midnight (you or anyone in the room) throws confetti; your first one each year is remembered in `localStorage`
 * (a cosmetic flag, no server). Reduced motion turns the particles and the evening shows off.
 *
 * `?theme=nytar&day=12-31T23:59&sky=2026-12-31T23:59` pins the evening; `?fireworks` adds a show.
 */
import {
  hopsIntoYear,
  midnightOf,
  NYTAR_BLOCKS,
  NYTAR_CHAIR,
  NYTAR_CLOCK,
  NYTAR_LAMPS,
  NYTAR_TABLE,
  nytarCaption,
  nytarShow,
  toMidnight,
} from "@tokenmaxxing/core/nytar.ts";
import { worldWall } from "@tokenmaxxing/core/range.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import {
  balloonSprite,
  CHAIR_PX,
  CLOCK_PX,
  chairSprite,
  clockSprite,
  TABLE_PX,
  tableSprite,
} from "../art/nytar.ts";
import { graphics } from "../settings/graphics.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import { addFireworks, rocketsNow } from "./fireworks.ts";
import type { Frame } from "./frame.ts";
import { drawGlow } from "./glow.ts";
import { pill } from "./labels.ts";
import { skyNow } from "./sky.ts";
import { world } from "./world.ts";

/** Whether the New Year's theme is on and we are in the town. */
export const nytarOn = (): boolean => world.room === "town" && festiveNow()?.id === "nytar";

/** Reduced motion and the particle density, worked out once a second (the settings object is rebuilt on each ask). */
let calmAt = -Infinity;
let calmed = { calm: false, density: 1 };
export function motion(now: number): { calm: boolean; density: number } {
  if (now - calmAt > 1000 || now < calmAt) {
    calmAt = now;
    const s = graphics.effective();
    calmed = { calm: s.reduceMotion, density: s.weather };
  }
  return calmed;
}

// MARK: Blocking and E

/** Whether a tile is one of the theme's (the watchman, the clock, the buffet, the chair): nothing walks onto it. */
export const nytarBlocks = (x: number, y: number): boolean =>
  nytarOn() && NYTAR_BLOCKS.some((b) => b.x === x && b.y === y);

const at = (t: { x: number; y: number }, x: number, y: number) => t.x === x && t.y === y;

/** E on the clock, the buffet or the chair says what it is. (The watchman is `festive-npc.ts`.) */
export function nytarInteract(x: number, y: number): boolean {
  if (!nytarOn()) return false;
  const year = midnightOf(skyNow()).year;
  let text: string | null = null;
  if (at(NYTAR_CLOCK, x, y)) text = `The Nytårsur. ${nytarCaption(skyNow())}`;
  else if (NYTAR_TABLE.some((t) => at(t, x, y)))
    text =
      "The Nytårs buffet: a kransekage tower, champagne, and a plate of something with almonds. Skål! 🥂";
  else if (at(NYTAR_CHAIR, x, y))
    text = `The jumping chair. Climb up in spirit, then press Space as the clock strikes twelve to jump into ${year}. 🎆`;
  if (!text) return false;
  hud.set({ dialog: text });
  return true;
}

// MARK: Confetti

export const CONFETTI_MAX = 240;
export const CONFETTI_COLOURS: readonly string[] = [
  "#f4c95d",
  "#ff5d73",
  "#5ee0ff",
  "#b18cff",
  "#7dff8a",
  "#fbf7ef",
];

/**
 * The confetti in the air, in tile coordinates (`h` the height above the ground in tiles). A pooled set of arrays that
 * both renderers read; `nytarTick` moves them once a frame. `n` of them are alive, packed at the front.
 */
export const confetti = {
  n: 0,
  x: new Float32Array(CONFETTI_MAX),
  y: new Float32Array(CONFETTI_MAX),
  h: new Float32Array(CONFETTI_MAX),
  vx: new Float32Array(CONFETTI_MAX),
  vy: new Float32Array(CONFETTI_MAX),
  vh: new Float32Array(CONFETTI_MAX),
  age: new Float32Array(CONFETTI_MAX),
  life: new Float32Array(CONFETTI_MAX),
  colour: new Uint8Array(CONFETTI_MAX),
  phase: new Float32Array(CONFETTI_MAX),
};

function spawn(x: number, y: number, h: number, vx: number, vy: number, vh: number): void {
  const c = confetti;
  if (c.n >= CONFETTI_MAX) return;
  const i = c.n++;
  c.x[i] = x;
  c.y[i] = y;
  c.h[i] = h;
  c.vx[i] = vx;
  c.vy[i] = vy;
  c.vh[i] = vh;
  c.age[i] = 0;
  c.life[i] = 3.5 + Math.random() * 2.5;
  c.colour[i] = Math.floor(Math.random() * CONFETTI_COLOURS.length);
  c.phase[i] = Math.random() * 6.28;
}

/** A burst of `count` pieces thrown up from tile (x, y). */
export function burstConfetti(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 2.6;
    spawn(x, y, 0.9, Math.cos(a) * s, Math.sin(a) * s * 0.7, 3 + Math.random() * 3);
  }
}

let lastTick = Number.NaN;
const seenJump = new Map<number, number>();
let ambientCarry = 0;

/** The year and whether the player has already hopped into it (a flag in `localStorage`). */
const hopKey = (year: number) => `nytar:hop:${year}`;
export const hoppedInto = (year: number): boolean => storage.getItem(hopKey(year)) === "1";

/**
 * Once a frame, from either renderer (`now` its animation clock in ms): moves the confetti, drops some from the sky
 * over the square at night, and notices hops near midnight. Idempotent for the same `now`.
 */
export function nytarTick(now: number): void {
  const dt = Number.isNaN(lastTick) || now < lastTick ? 0 : Math.min(0.1, (now - lastTick) / 1000);
  if (now === lastTick) return;
  lastTick = now;
  const c = confetti;
  // Fall: a flutter, slowing to a drift; sideways with a little sway.
  for (let i = c.n - 1; i >= 0; i--) {
    c.age[i]! += dt;
    if (c.age[i]! >= c.life[i]! || c.h[i]! < 0) {
      // Swap with the last alive one.
      const j = --c.n;
      if (i !== j) {
        for (const k of [c.x, c.y, c.h, c.vx, c.vy, c.vh, c.age, c.life, c.phase]) k[i] = k[j]!;
        c.colour[i] = c.colour[j]!;
      }
      continue;
    }
    c.vh[i]! = Math.max(-0.9, c.vh[i]! - 9 * dt);
    const drag = Math.max(0, 1 - 1.6 * dt);
    c.vx[i]! *= drag;
    c.vy[i]! *= drag;
    c.x[i]! += (c.vx[i]! + Math.sin(c.age[i]! * 3 + c.phase[i]!) * 0.25) * dt;
    c.y[i]! += c.vy[i]! * dt;
    c.h[i]! += c.vh[i]! * dt;
  }
  if (!nytarOn()) {
    c.n = 0;
    seenJump.clear();
    return;
  }
  const { calm, density } = motion(now);
  if (calm) {
    c.n = 0;
    return;
  }
  const f = festiveNow();
  // The drizzle: from the evening of the 31st, thicker as midnight nears and for the show after it.
  if (f && f.intensity > 0.6 && dt > 0) {
    const ms = skyNow();
    const after = ms - midnightOf(ms).at;
    const boost = after >= 0 && after < 10 * 60_000 ? 3 : 1;
    ambientCarry += 26 * ((f.intensity - 0.55) / 0.45) * density * boost * dt;
    while (ambientCarry >= 1) {
      ambientCarry -= 1;
      spawn(
        2 + Math.random() * 16,
        1.5 + Math.random() * 6,
        5 + Math.random() * 1.5,
        0,
        0,
        -0.5 - Math.random() * 0.4,
      );
    }
  }
  // Hops: anyone whose hop started within three seconds of midnight throws confetti.
  const wall = skyNow();
  for (const a of world.avatars.values()) {
    if (a.jump === null) continue;
    if (seenJump.get(a.info.id) === a.jump) continue;
    seenJump.set(a.info.id, a.jump);
    if (!hopsIntoYear(wall - (performance.now() - a.jump))) continue;
    const mine = a.info.id === world.selfId;
    burstConfetti(a.x, a.y, mine ? 120 : 45);
    const year = midnightOf(wall).year;
    if (mine && !hoppedInto(year)) {
      storage.setItem(hopKey(year), "1");
      hud.set({ dialog: `🎉 You jumped into ${year}! Godt nytår!` });
    }
  }
}

// MARK: The evening's shows

// The small shows every half hour on the evening of the 31st (and, pinned with `?sky=`, the midnight one too).
addFireworks((now) => {
  if (festiveNow()?.id !== "nytar" || motion(performance.now()).calm) return null;
  const sky = skyNow();
  const show = nytarShow(sky, Math.abs(sky - Date.now()) > 120_000);
  return show && { ...show, at: show.at - (sky - now) };
});

// MARK: The party lights

const BULB_RGB = ["255,200,90", "255,110,130", "110,220,255", "190,150,255", "150,255,160"] as const;
const BULB_HEX = ["#ffd35a", "#ff6e82", "#6edcff", "#be96ff", "#96ffa0"] as const;

interface Bulb {
  x: number;
  y: number;
  k: number;
}

/** The strings of lights: each from lamp to lamp at a height (world pixels, the lamps' heads are 11 above their tile), with a sag. */
const STRING_DEFS = [
  { y: NYTAR_LAMPS.top * TILE - 11, sag: 13 },
  { y: NYTAR_LAMPS.bottom * TILE - 11, sag: 10 },
] as const;
const STRING_X0 = NYTAR_LAMPS.left * TILE + TILE / 2;
const STRING_X1 = NYTAR_LAMPS.right * TILE + TILE / 2;
const sagAt = (def: (typeof STRING_DEFS)[number], t: number): number => def.y + 4 * def.sag * t * (1 - t);

/** The bulbs along each string, evenly spaced. */
const STRINGS: Bulb[][] = STRING_DEFS.map((def) => {
  const n = 34;
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: STRING_X0 + ((STRING_X1 - STRING_X0) * i) / n,
    y: sagAt(def, i / n),
    k: i % BULB_HEX.length,
  }));
});

/** Bulbs twinkle in turn. */
const twinkle = (now: number, i: number, k: number): number =>
  0.55 + 0.45 * Math.sin(now / 260 + i * 1.3 + k);

// MARK: Drawing

/** The clock's centre in world pixels, and its sprite's top-left. */
const clockBox = () => {
  const left = NYTAR_CLOCK.x * TILE + TILE / 2 - CLOCK_PX.w / 2;
  const top = (NYTAR_CLOCK.y + 1) * TILE - CLOCK_PX.h;
  return { left, top, cx: left + CLOCK_PX.cx, cy: top + CLOCK_PX.cy };
};

/** A one-pixel line from the clock's centre at `angle` (0 up, clockwise), `len` long. */
function hand(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  len: number,
  colour: string,
) {
  g.fillStyle = colour;
  for (let d = 0; d <= len; d++)
    g.fillRect(Math.round(cx + Math.sin(angle) * d), Math.round(cy - Math.cos(angle) * d), 1, 1);
}

export function drawNytar(f: Frame): void {
  if (!nytarOn()) return;
  const { g, items, labels, toScreen, now, dpr, scale } = f;
  nytarTick(now);
  const sky = skyNow();
  const year = midnightOf(sky).year;

  // The Nytårsur, with its hands on the real time.
  const clock = clockBox();
  items.push({
    y: (NYTAR_CLOCK.y + 1) * TILE - 1,
    draw: () => {
      g.drawImage(clockSprite(year), clock.left, clock.top);
      const w = worldWall(sky);
      const s = w.second + (sky % 1000) / 1000;
      const m = w.minute + s / 60;
      const h = (w.hour % 12) + m / 60;
      hand(g, clock.cx, clock.cy, (h / 12) * Math.PI * 2, 4, "#2b2433");
      hand(g, clock.cx, clock.cy, (m / 60) * Math.PI * 2, 6, "#2b2433");
      hand(g, clock.cx, clock.cy, (s / 60) * Math.PI * 2, 7, "#d8283a");
      g.fillStyle = "#2b2433";
      g.fillRect(clock.cx - 1, clock.cy - 1, 2, 2);
    },
  });

  // The buffet, the chair and the balloons.
  const t0 = NYTAR_TABLE[0]!;
  items.push({
    y: (t0.y + 1) * TILE - 1,
    draw: () => g.drawImage(tableSprite(), t0.x * TILE, (t0.y + 1) * TILE - TABLE_PX.h),
  });
  items.push({
    y: (NYTAR_CHAIR.y + 1) * TILE - 1,
    draw: () =>
      g.drawImage(
        chairSprite(),
        NYTAR_CHAIR.x * TILE + Math.floor((TILE - CHAIR_PX.w) / 2),
        (NYTAR_CHAIR.y + 1) * TILE - CHAIR_PX.h,
      ),
  });
  const sway = (i: number) => Math.round(Math.sin(now / 900 + i * 2));
  // Balloons tied beside the clock and the chair, on the row below (so they float over the open street).
  items.push({
    y: (NYTAR_CLOCK.y + 2) * TILE,
    draw: () =>
      g.drawImage(
        balloonSprite(0),
        (NYTAR_CLOCK.x + 1) * TILE - 2 + sway(0),
        (NYTAR_CLOCK.y + 2) * TILE - 31,
      ),
  });
  items.push({
    y: (NYTAR_CHAIR.y + 2) * TILE,
    draw: () =>
      g.drawImage(balloonSprite(2), NYTAR_CHAIR.x * TILE - 12 + sway(1), (NYTAR_CHAIR.y + 2) * TILE - 31),
  });

  // The party lights, over everything in the square (and under the night's tint, so they glow with it).
  items.push({
    y: 99_999,
    draw: () => {
      for (const [s, bulbs] of STRINGS.entries()) {
        // The cord, a pixel every step, then the bulbs hanging from it.
        g.fillStyle = "#2b2433";
        for (let x = STRING_X0; x <= STRING_X1; x++)
          g.fillRect(x, Math.round(sagAt(STRING_DEFS[s]!, (x - STRING_X0) / (STRING_X1 - STRING_X0))), 1, 1);
        for (const [i, b] of bulbs.entries()) {
          g.fillStyle = BULB_HEX[b.k]!;
          g.globalAlpha = twinkle(now, i, s);
          g.fillRect(Math.round(b.x) - 1, Math.round(b.y) + 1, 3, 4);
        }
        g.globalAlpha = 1;
      }
    },
  });

  // The sign over the clock, and the confetti over everything.
  const [sx, sy] = toScreen(clock.cx, clock.top - 2);
  const hopped = hoppedInto(year);
  labels.push(() => {
    const text = nytarCaption(sky) + (hopped ? " · ✓ hoppet" : "");
    pill(g, sx, sy - 2 * dpr, text, dpr, "rgba(26, 37, 82, 0.88)", "#f4c95d");
  });
  if (confetti.n > 0)
    labels.push(() => {
      const size = Math.max(2, Math.round(1.6 * scale));
      const c = confetti;
      for (let i = 0; i < c.n; i++) {
        const [px, py] = toScreen(c.x[i]! * TILE + TILE / 2, c.y[i]! * TILE + TILE / 2 - c.h[i]! * TILE);
        const fade = Math.min(1, (c.life[i]! - c.age[i]!) * 2);
        g.globalAlpha = fade;
        g.fillStyle = CONFETTI_COLOURS[c.colour[i]!]!;
        // A flake that flips: wide, then thin.
        const flip = Math.abs(Math.sin(c.age[i]! * 7 + c.phase[i]!));
        g.fillRect(px, py, size * (1 + flip), size * (1.6 - flip * 0.6));
      }
      g.globalAlpha = 1;
    });
}

/** The lights' glow, over the night's tint (in `drawLight`'s world space), at `strength` (the lamps'). */
export function lightNytar(g: CanvasRenderingContext2D, strength: number, now: number): void {
  if (!nytarOn()) return;
  const clock = clockBox();
  // The clock's face is lit from inside.
  drawGlow(g, clock.cx, clock.cy, 22, "255,226,150", strength * 0.9);
  const t0 = NYTAR_TABLE[0]!;
  drawGlow(g, (t0.x + 1) * TILE, (t0.y + 1) * TILE - 14, 22, "255,214,150", strength * 0.55);
  for (const [s, bulbs] of STRINGS.entries())
    for (const [i, b] of bulbs.entries())
      if (i % 2 === 0) drawGlow(g, b.x + 1, b.y + 2, 9, BULB_RGB[b.k]!, strength * 0.7 * twinkle(now, i, s));
}

// For `scripts/qa/festive-nytar.mjs`: the QA handle (`game/qa.ts`) is on when `tokenmaxxing.qa` is set.
if (typeof window !== "undefined" && storage.getItem("tokenmaxxing.qa"))
  Object.assign(window, {
    __nytar: {
      blocks: nytarBlocks,
      on: nytarOn,
      confetti,
      /** Ms to the stroke of midnight on the page's clock, and the rockets in the air. */
      left: () => toMidnight(skyNow()),
      rockets: () => rocketsNow().length,
    },
  });
