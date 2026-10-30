/**
 * The town's festive themes (Halloween, Christmas): a tint, a mist, a HUD accent and a toast over a few days,
 * worked out from the world's clock (Copenhagen) and nothing else, like the calendar they stand on
 * (`holidays.ts`). A theme is a layer: it never changes what the sprites or the 3D town are baked from, bar one
 * coarse key (`festiveKey`). Props, music and shop stock hang off the same `Festive`.
 *
 * Not `themes.ts`: that is the music.
 */
import { CHRISTMAS_NPC } from "./christmas.ts";
import { HENNING } from "./befrielsen.ts";
import { daysFrom, HOLIDAYS, type HolidayId, minutesFrom, near } from "./holidays.ts";
import { BALTALER } from "./midsommer.ts";
import { NYTAR_NPC } from "./nytar.ts";
import { PAASKE_FARMER } from "./paaske.ts";
import { worldWall } from "./range.ts";
import { copenhagenToMs } from "./sky.ts";
import { GERDA } from "./spooky.ts";
import type { Facing } from "./world.ts";

export type FestiveId =
  | "halloween"
  | "christmas"
  | "sanktHans"
  | "nytar"
  | "paaske"
  | "befrielsen"
  | "agustusan";

export interface FestiveDef {
  id: FestiveId;
  /** The anchor day, from `HOLIDAYS` (no second date table). */
  holiday: HolidayId;
  /** Whole days before the anchor the window opens. */
  before: number;
  /** Whole days after it the window stays. */
  after: number;
  /** Minutes from the anchor's midnight -> 0..1 build-up; clamped, never 0, non-decreasing. */
  ramp: (minutesFromAnchor: number) => number;
}

/** Linear from `lo` at `from` to `hi` at `to` (minutes from the anchor's midnight), flat outside. */
function rampBetween(from: number, to: number, lo: number, hi: number): (minutes: number) => number {
  return (m) => lo + (hi - lo) * Math.min(1, Math.max(0, (m - from) / (to - from)));
}

const DAY_MIN = 1440;

export const FESTIVE: Record<FestiveId, FestiveDef> = {
  // 30 Oct (-1) and 31 Oct (0). Ramp: 0.5 at open, 1 from 31 Oct 16:00.
  halloween: {
    id: "halloween",
    holiday: "halloween",
    before: 1,
    after: 0,
    ramp: rampBetween(-DAY_MIN, 16 * 60, 0.5, 1),
  },
  // 18 Dec (-6) to 25 Dec (+1). Ramp: 0.15 on the 18th rising to 1 at 24 Dec 18:00; 1 on the 25th.
  christmas: {
    id: "christmas",
    holiday: "christmas",
    before: 6,
    after: 1,
    ramp: rampBetween(-6 * DAY_MIN, 18 * 60, 0.15, 1),
  },
  // 22 and 23 June. Ramp: 0.4 at open, 1 from the bonfire at 20:00 on the 23rd.
  sanktHans: {
    id: "sanktHans",
    holiday: "sanktHans",
    before: 1,
    after: 0,
    ramp: rampBetween(-DAY_MIN, 20 * 60, 0.4, 1),
  },
  // 30 Dec to 1 Jan. Ramp: 0.3 at open, 1 at midnight (the start of 1 Jan) and after.
  nytar: {
    id: "nytar",
    holiday: "newYear",
    before: 1,
    after: 1,
    ramp: rampBetween(-DAY_MIN, DAY_MIN, 0.3, 1),
  },
  // Palm Sunday to Easter Monday. Ramp: 0.2 on Palm Sunday, 1 from noon on Easter Sunday.
  paaske: {
    id: "paaske",
    holiday: "paaske",
    before: 7,
    after: 1,
    ramp: rampBetween(-7 * DAY_MIN, 12 * 60, 0.2, 1),
  },
  // 4 and 5 May. Ramp: 0.5 at open, 1 from 21:00 on the 4th (candles in the windows).
  befrielsen: {
    id: "befrielsen",
    holiday: "befrielsen",
    before: 0,
    after: 1,
    ramp: rampBetween(0, 21 * 60, 0.5, 1),
  },
  // 10 to 17 August. Ramp: 0.2 on the 10th, 1 from 10:00 on the 17th.
  agustusan: {
    id: "agustusan",
    holiday: "agustusan",
    before: 7,
    after: 0,
    ramp: rampBetween(-7 * DAY_MIN, 10 * 60, 0.2, 1),
  },
};

export interface Festive {
  id: FestiveId;
  /** 0..1 build-up (see `ramp`). Never 0 while active, so `intensity > 0` means active. */
  intensity: number;
  /** Days from the anchor (negative before it): for "N sleeps to Christmas" copy. */
  days: number;
}

const IDS = Object.keys(FESTIVE) as FestiveId[];

const festiveOf = (def: FestiveDef, ms: number): Festive => ({
  id: def.id,
  intensity: Math.min(1, Math.max(0.01, def.ramp(minutesFrom(def.holiday, ms)))),
  days: daysFrom(def.holiday, ms),
});

/** The active theme at `ms`, or null. Overlaps resolve by `FESTIVE` key order (none overlap today). */
export function festiveAt(ms: number): Festive | null {
  for (const id of IDS) {
    const def = FESTIVE[id];
    if (near(def.holiday, ms, def.before, def.after)) return festiveOf(def, ms);
  }
  return null;
}

/** A dev pin: a theme shown as of `ms`, no matter the real date; `"off"` shows none; null is no pin. */
export type FestivePin = { id: FestiveId; ms: number } | "off" | null;

/** The id a pin's name means, ignoring case (`sankthans`, `nytar`, `paaske`), or null. */
const idOf = (name: string): FestiveId | null => IDS.find((id) => id.toLowerCase() === name) ?? null;

/**
 * Pin text -> a pin: `christmas` (its eve, at noon), `christmas@12-22` (noon), `halloween@10-31T21:00`, `off`.
 * The year is `nowMs`'s. Anything else is null.
 */
export function parseFestivePin(text: string, nowMs: number): FestivePin {
  const t = text.trim().toLowerCase();
  if (t === "off") return "off";
  const [word = "", when, ...rest] = t.split("@");
  const name = idOf(word);
  if (rest.length > 0 || !name) return null;
  const year = worldWall(nowMs).y;
  if (when === undefined) {
    const [m, d] = HOLIDAYS[FESTIVE[name].holiday].date(year);
    return { id: name, ms: copenhagenToMs(`${year}-${pad(m)}-${pad(d)}T12:00`)! };
  }
  const m = /^(\d\d)-(\d\d)(?:[tT](\d\d):(\d\d))?$/.exec(when);
  if (!m) return null;
  const [mo, d, h = 12, mi = 0] = [m[1], m[2], m[3], m[4]].map((x) =>
    x === undefined ? undefined : Number(x),
  );
  if (mo === undefined || d === undefined) return null;
  // A real date that year (02-30 and, off a leap year, 02-29 are not), and a real time.
  const check = new Date(Date.UTC(year, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  const ms = copenhagenToMs(`${year}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`);
  return ms === null ? null : { id: name, ms };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A pin (if any) over the clock. The one function every consumer calls, through the web and server wrappers.
 * A pinned theme is shown whether or not the date is in its window, as of the pin's `ms`.
 */
export function festiveWith(pin: FestivePin, ms: number): Festive | null {
  if (pin === "off") return null;
  if (pin) return festiveOf(FESTIVE[pin.id], pin.ms);
  return festiveAt(ms);
}

/** Coarse bucket for bake keys: `halloween.2` (intensity in quarters) or "". Changes at most 4 times a window. */
export const festiveKey = (f: Festive | null): string => (f ? `${f.id}.${Math.round(f.intensity * 4)}` : "");

/** Extra fog at full intensity, 0..0.4, by theme (the sky's `fogOf` stays the weather's): Halloween's ground mist. */
export const FESTIVE_FOG: Partial<Record<FestiveId, number>> = { halloween: 0.35 };

/** Extra fog, 0..0.4, for the theme, scaled by its intensity. */
export const festiveFog = (f: Festive | null): number => (f ? (FESTIVE_FOG[f.id] ?? 0) * f.intensity : 0);

// MARK: Each theme's named NPC

/** A festive theme's one named person in town, there only while the theme is (`festiveNpcOf`). */
export interface FestiveNpc {
  /** Stable key for its sprite (`web/src/art/festive-npc.ts`) and model (`web/src/render3d/town/festive-npc3d.ts`). */
  id: string;
  name: string;
  /** The tile it stands on, in the town, and the way it faces. */
  x: number;
  y: number;
  facing: Facing;
  /** What it says, one line per press of E (and the next in turn); about the day and what players can do. */
  lines: string[];
}

/**
 * The registry: fill a theme's slot (a feature agent's one edit here), then add its sprite to `NPC_SPRITES`
 * (`web/src/art/festive-npc.ts`) and its model builder to `NPC_MODELS` (`web/src/render3d/town/festive-npc3d.ts`).
 * Null is no NPC. The spawning, the label, the dialogue on E and the despawn at the window's end are generic.
 */
export const FESTIVE_NPC: Record<FestiveId, FestiveNpc | null> = {
  halloween: GERDA,
  christmas: CHRISTMAS_NPC,
  sanktHans: BALTALER,
  nytar: NYTAR_NPC,
  paaske: PAASKE_FARMER,
  befrielsen: HENNING,
  agustusan: null,
};

/** The NPC for the theme in play, or null. */
export const festiveNpcOf = (f: Festive | null): FestiveNpc | null => (f ? FESTIVE_NPC[f.id] : null);
