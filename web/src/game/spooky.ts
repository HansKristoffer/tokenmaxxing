/**
 * Halloween's spooky night in 2D (`core/src/spooky.ts`), on the 30th and 31st: bats, ghosts, cobwebs on the doors,
 * the cauldron, the lawn's extra tombstones, sweets, and trick-or-treat at the doorsteps. Drawn from
 * `drawPumpkins` and lit from `lightPumpkins` (`halloween.ts`), so `render.ts` needs nothing. The 3D town is
 * `render3d/town/halloween3d.ts`. Both ask `spookyOn()`, which is the festive theme being Halloween.
 *
 * Trick-or-treat: what a door gives is a hash of the door and the day (`treatAt`). The server keeps every knock
 * (`world.knock`), so knocking on every door in one night is the Sugar king badge and the Candy bucket hat; this
 * browser keeps a copy of today's doors and the candy for the bucket on screen.
 */
import { doorSteps } from "@tokenmaxxing/core/halloween.ts";
import {
  batAt,
  batCount,
  CANDY_SPOTS,
  CAULDRON,
  dayKey,
  doorKey,
  EXTRA_STONES,
  GERDA_TILE,
  ghostAt,
  HAUNTS,
  type Knock,
  STIR_LINES,
  spookyBlocks,
  TREAT_CANDY,
  treatSays,
} from "@tokenmaxxing/core/spooky.ts";
import { type Facing, TILE } from "@tokenmaxxing/core/world.ts";
import {
  batSprite,
  candySprite,
  cauldronSprite,
  cobwebSprite,
  extraStoneSprite,
  GERDA_LANTERN,
  ghostSprite,
} from "../art/spooky.ts";
import { conn } from "../net.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import { type Frame, inView } from "./frame.ts";
import { drawGlow, flicker } from "./glow.ts";
import { skyNow } from "./sky.ts";
import { self, world } from "./world.ts";

/** Whether the spooky layer is on: the town, and the festive theme being Halloween (the setting and pins count). */
export const spookyOn = (): boolean => world.room === "town" && festiveNow()?.id === "halloween";

// MARK: The candy bucket (shared by the HUD chip and both renderers)

const CANDY_KEY = "halloween:candy";
const listeners = new Set<() => void>();
let version = 0;

export interface Bucket {
  /** Sweets collected, all told (the server's count, as of the last knock). */
  candy: number;
  /** Doors that have opened today, and how many there are. */
  doors: number;
  of: number;
  version: number;
}

// Keep server-confirmed knocks separate from the old browser-only trick-or-treat progress.
const knockKey = (day: string, door: string): string => `halloween:server:${day}:${door}`;

/** The bucket now. */
export function bucket(): Bucket {
  const day = dayKey(skyNow());
  const steps = doorSteps(world.map);
  return {
    candy: Number(storage.getItem(CANDY_KEY)) || 0,
    doors: steps.filter((s) => storage.getItem(knockKey(day, doorKey(s.door)))).length,
    of: steps.length,
    version,
  };
}

export const subscribeBucket = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const changed = (): void => {
  version++;
  for (const fn of listeners) fn();
};

// MARK: Interaction

let stirs = 0;

/** E on (x, y), facing `facing`: knocks a doorstep (the server opens it), stirs the cauldron, reads a lawn stone. False when it's none of those (or the theme's off). */
export function spookyInteract(x: number, y: number, facing: Facing): boolean {
  if (!spookyOn()) return false;
  if (x === CAULDRON.x && y === CAULDRON.y) {
    hud.set({ dialog: STIR_LINES[stirs++ % STIR_LINES.length]! });
    return true;
  }
  const stone = EXTRA_STONES.find((s) => s.x === x && s.y === y);
  if (stone) {
    hud.set({ dialog: `🪦 "${stone.text}". Nobody lies here yet. Gerda keeps it for the next model to go.` });
    return true;
  }
  const step = doorSteps(world.map).find((d) => d.x === x && d.y === y);
  if (!step) return false;
  const day = dayKey(skyNow());
  // The paper shares the Tavern step. Ask the server first: old local progress cannot prove this door counted.
  const tavern = world.map.at(step.door[0], step.door[1]) === "I";
  void conn
    .knock(facing)
    .then((r) => {
      if (!r) return;
      if ("notice" in r) return void hud.set({ dialog: r.notice });
      knocked(r, day);
      if (tavern && r.treat === null) hud.set({ dialog: null, panel: { kind: "paper" } });
    })
    .catch(() => hud.set({ dialog: "🎃 Nobody heard you. Try again." }));
  return true;
}

/** What the door said: the bucket takes the server's count (it keeps the knocks, for the badge), and the line. */
function knocked(r: Knock, day: string): void {
  for (const door of r.knocked) storage.setItem(knockKey(day, door), "1");
  storage.setItem(CANDY_KEY, String(r.candy));
  changed();
  if (r.treat === null)
    return void hud.set({
      dialog: "🎃 You've knocked here already today. Try another door, or come back tomorrow.",
    });
  const got = TREAT_CANDY[r.treat];
  const tail = got ? ` +${got} 🍬` : "";
  const all = r.king
    ? " That was every door tonight: sugar king! 🍬 The Candy bucket hat is in your bag."
    : r.knocked.length >= r.of && r.of > 0
      ? " That was every door tonight: sugar king!"
      : ` ${r.knocked.length}/${r.of} doors.`;
  hud.set({ dialog: `🎃 ${treatSays(r.treat, r.door, day)}${tail}${all}` });
}

/** The lawn stones, Gerda and the cauldron take a step off you. */
export const blocksSpooky = (x: number, y: number): boolean => spookyOn() && spookyBlocks(x, y);

// MARK: Drawing

/** The doors in the town, for the cobwebs: asked per map. */
let doors: { map: unknown; list: ReturnType<typeof doorSteps> } | null = null;
const doorsNow = (): ReturnType<typeof doorSteps> => {
  if (doors?.map !== world.map) doors = { map: world.map, list: doorSteps(world.map) };
  return doors.list;
};

export function drawSpooky(f: Frame): void {
  if (!spookyOn()) return;
  const { g, items, now } = f;
  const t = now / 1000;
  const intensity = festiveNow()?.intensity ?? 0.5;

  for (const s of EXTRA_STONES) {
    const sprite = extraStoneSprite(s.kind, s.text);
    const [x, y] = [s.x * TILE, (s.y + 1) * TILE - sprite.height];
    if (inView(f, x, y, TILE, sprite.height, TILE))
      items.push({ y: (s.y + 1) * TILE - 1, draw: () => g.drawImage(sprite, x, y) });
  }

  const cauldron = cauldronSprite(Math.floor(now / 260) % 3);
  const [cx, cy] = [CAULDRON.x * TILE, (CAULDRON.y + 1) * TILE - cauldron.height];
  if (inView(f, cx, cy, TILE, cauldron.height, TILE))
    items.push({ y: (CAULDRON.y + 1) * TILE - 1, draw: () => g.drawImage(cauldron, cx, cy) });

  for (const c of CANDY_SPOTS) {
    const sprite = candySprite(c.c);
    const [x, y] = [Math.round(c.x * TILE), Math.round(c.y * TILE)];
    if (inView(f, x, y, 5, 3, TILE)) items.push({ y: y + 1, draw: () => g.drawImage(sprite, x, y) });
  }

  // Cobwebs in the top corners of each door, over the wall above it.
  const web = cobwebSprite();
  for (const { door } of doorsNow()) {
    const [x, y] = [door[0] * TILE - 1, door[1] * TILE - 3];
    if (!inView(f, x, y, TILE + 2, 10, TILE)) continue;
    items.push({
      y: (door[1] + 1) * TILE + 1,
      draw: () => {
        g.drawImage(web, x, y);
        g.save();
        g.translate(x + TILE + 2, y);
        g.scale(-1, 1);
        g.drawImage(web, 0, 0);
        g.restore();
      },
    });
  }

  // The ghosts: see-through, bobbing, and shy of anyone close.
  const me = self();
  for (const [i, h] of HAUNTS.entries()) {
    const p = ghostAt(h, t);
    const sprite = ghostSprite(h.hue, Math.floor(now / 420 + i) % 2);
    const [x, y] = [p.x * TILE + TILE / 2, (p.y + 1) * TILE - p.lift * TILE];
    const d = me ? Math.hypot(me.x + 0.5 - (p.x + 0.5), me.y + 0.5 - (p.y + 0.5)) : 9;
    const shy = Math.min(1, Math.max(0, (d - 1) / 1.5));
    if (!inView(f, x - 8, y - 20, 16, 24, TILE) || shy <= 0.02) continue;
    const w = sprite.width * h.size;
    const hh = sprite.height * h.size;
    items.push({
      y: y + 6,
      draw: () => {
        g.save();
        g.globalAlpha = (0.62 + 0.14 * Math.sin(t * 2 + i)) * shy;
        g.drawImage(sprite, Math.round(x - w / 2), Math.round(y - hh), w, hh);
        g.restore();
      },
    });
  }

  // The bats, circling the Tavern, the windmill and the graveyard: on top of the roofs.
  for (let i = 0; i < batCount(intensity); i++) {
    const b = batAt(i, t);
    const sprite = batSprite(Math.floor(b.flap / Math.PI) % 2);
    const [x, y] = [Math.round(b.x * TILE), Math.round(b.y * TILE - b.h * 13)];
    if (!inView(f, x, y, 9, 5, TILE)) continue;
    items.push({ y: 1e6, draw: () => g.drawImage(sprite, x, y) });
  }
}

/** The glows over the night's tint (`lightPumpkins`, `halloween.ts`), in world space: the brew, Gerda's lantern, the ghosts. */
export function lightSpooky(g: CanvasRenderingContext2D, strength: number, now: number): void {
  if (!spookyOn()) return;
  const k = flicker(now, 3);
  drawGlow(g, CAULDRON.x * TILE + 8, CAULDRON.y * TILE + 5, 18 * k, "124,252,90", (0.3 + 0.6 * strength) * k);
  drawGlow(
    g,
    GERDA_TILE.x * TILE + GERDA_LANTERN[0],
    GERDA_TILE.y * TILE + GERDA_LANTERN[1] - 4,
    22 * k,
    "255,170,60",
    (0.3 + 0.6 * strength) * k,
  );
  const t = now / 1000;
  for (const h of HAUNTS) {
    const p = ghostAt(h, t);
    drawGlow(
      g,
      p.x * TILE + TILE / 2,
      (p.y + 1) * TILE - 8,
      16,
      h.hue === "blue" ? "150,220,255" : "210,214,255",
      0.35 * strength,
    );
  }
}
