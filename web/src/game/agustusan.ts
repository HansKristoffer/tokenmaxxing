/**
 * Agustusan in 2D (`core/src/agustusan.ts`): flags, umbul-umbul and bunting, the gapura, and from the 14th the lomba
 * props. The lomba are played in the browser (E in front of a prop): panjat pinang, makan kerupuk and balap karung,
 * for medals kept in `localStorage` by year. Nothing is sent to the server: the medals are only for show. The 3D town
 * is `render3d/town/agustusan3d.ts`, and both ask `agustusanNow()`, so the setting and the theme pins reach them.
 */
import {
  anniversary,
  BUNTING_ROWS,
  climb,
  flagSpots,
  flagsUp,
  GAPURA,
  isBlocked,
  isUmbul,
  KERUPUK,
  KERUPUK_BITES,
  KERUPUK_GAP_MS,
  LOMBA_NAMES,
  type Lomba,
  PANJAT,
  PANJAT_SLIDE_MS,
  PANJAT_TOP,
  SACK,
  SACK_PAR_MS,
  type Spot,
  standing,
  TUMPENG,
} from "@tokenmaxxing/core/agustusan.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import {
  buntingSprite,
  climberSprite,
  FLAG_PX,
  FLAG_TIE,
  flagSprite,
  GAPURA_PX,
  GAPURA_TIE,
  gapuraSprite,
  kerupukSprite,
  laneFlagSprite,
  POLE_CLIMB,
  POLE_PX,
  poleSprite,
  TUMPENG_PX,
  tumpengSprite,
} from "../art/agustusan.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { festiveNow } from "./festive.ts";
import { type Frame, inView } from "./frame.ts";
import { sign } from "./labels.ts";
import { skyNow } from "./sky.ts";
import { self, world } from "./world.ts";

/** What stands in town now: the stage of the build-up, the flags that are up. Null outside Agustusan and the town. */
export interface AgustusanNow {
  days: number;
  intensity: number;
  stand: ReturnType<typeof standing>;
  flags: Spot[];
  /** How many of the flags are up. */
  up: number;
}

let spots: { map: unknown; flags: Spot[] } | null = null;

/** Agustusan in town now, or null. Cheap: `festiveNow` is cached per minute, the flag list per map. */
export function agustusanNow(): AgustusanNow | null {
  if (world.room !== "town") return null;
  const f = festiveNow();
  if (f?.id !== "agustusan") return null;
  if (spots?.map !== world.map) spots = { map: world.map, flags: flagSpots(world.map) };
  const flags = spots.flags;
  return {
    days: f.days,
    intensity: f.intensity,
    stand: standing(f.days),
    flags,
    up: flagsUp(flags.length, f.intensity),
  };
}

/** The year's medals, as `agustusan:2026:panjat` flags. */
const medalKey = (l: Lomba): string => `agustusan:${anniversary(skyNow()) + 1945}:${l}`;
const LOMBAS: Lomba[] = ["panjat", "kerupuk", "karung"];
export const medalsWon = (): Lomba[] => LOMBAS.filter((l) => storage.getItem(medalKey(l)) === "1");

/** Awards a medal; the line to say about it. */
function award(l: Lomba, what: string): string {
  const had = storage.getItem(medalKey(l)) === "1";
  storage.setItem(medalKey(l), "1");
  const n = medalsWon().length;
  const head = had
    ? `${what} Another medal for the shelf, but you already won this one.`
    : `${what} 🥇 Medali ${LOMBA_NAMES[l]}!`;
  const tail =
    n === LOMBAS.length
      ? " Juara umum: all three medals this year. MERDEKA!"
      : ` (${n} of 3 medals this year.)`;
  return head + tail;
}

// MARK: The lomba

const say = (text: string): void => hud.set({ dialog: text });

let pole = { h: 0, at: 0, won: 0 };
/** The climber's height on the pole now: it slides back a step a second while nobody pushes. */
export function climberHeight(now: number): number {
  // Won: the top while they cheer, then back at the foot for the next climber.
  if (pole.won) return now - pole.won < 1800 ? PANJAT_TOP : 0;
  return Math.max(0, pole.h - Math.max(0, Math.floor((now - pole.at) / PANJAT_SLIDE_MS)));
}

let bites = { n: 0, at: 0, won: 0 };
/** The kerupuk's bite count now, 0 when it has swung away. */
export const kerupukBites = (now: number): number => (now - bites.at > KERUPUK_GAP_MS ? 0 : bites.n);

let race: { at: number } | null = null;

/** What a press of E on the pole says. */
function climbPole(now: number): string {
  const a = agustusanNow();
  if (!a?.stand.play)
    return "🧗 The panjat pinang pole: grease and prizes on top. The lomba start on the 15th.";
  const cur = climberHeight(now);
  const next = climb(cur, Math.random());
  pole = { h: next, at: now, won: 0 };
  if (next >= PANJAT_TOP) {
    pole.won = now;
    return award("panjat", "🧗 You reach the top and cut the prizes down! The whole square cheers.");
  }
  if (next > cur) return `🧗 Up you go: ${next} of ${PANJAT_TOP}. The grease is thick; keep going!`;
  return `🧗 Slip! Down to ${next}. Everybody laughs: that is the point. ${next} of ${PANJAT_TOP}.`;
}

/** What a bite at the kerupuk says. */
function biteKerupuk(now: number): string {
  const a = agustusanNow();
  if (!a?.stand.play)
    return "🍘 Makan kerupuk: a cracker on a string, hands behind your back. It starts on the 15th.";
  const n = (now - bites.at > KERUPUK_GAP_MS ? 0 : bites.n) + 1;
  bites = { n, at: now, won: 0 };
  if (n >= KERUPUK_BITES) {
    bites = { n: 0, at: 0, won: now };
    return award("kerupuk", "🍘 Crunch! The last crumb is gone before the string stops swinging.");
  }
  return `🍘 Nyam! Bite ${n} of ${KERUPUK_BITES}. Quick, it swings: bite again before it gets away.`;
}

/** The finish: the tile before the flag, at the end of the lane. */
const FINISH_TILE: Spot = { x: SACK.laneX1, y: SACK.y };
const parMs = (): number => SACK_PAR_MS;

/** What E at the start flag says (and the race is on). */
function startRace(now: number): string {
  const a = agustusanNow();
  if (!a?.stand.play) return "🏁 Balap karung, the sack race, starts on the 15th.";
  race = { at: now };
  return `🏁 Siap... mulai! Run along the lane to the finish flag, hold Shift to run. Under ${(parMs() / 1000).toFixed(1)} seconds wins a medal.`;
}

/** Once a frame: the sack race ends when you reach the end of the lane. */
function watchRace(now: number): void {
  if (!race) return;
  const me = self();
  if (now - race.at > 30_000 || !me) {
    race = null;
    return;
  }
  if (me.x !== FINISH_TILE.x || me.y !== FINISH_TILE.y) return;
  const took = now - race.at;
  race = null;
  const s = (took / 1000).toFixed(2);
  if (took <= parMs()) say(award("karung", `🏁 ${s} seconds! You hop over the finish line first.`));
  else
    say(
      `🏁 ${s} seconds. Not fast enough for the medal (under ${(parMs() / 1000).toFixed(1)}); hold Shift to run and try again.`,
    );
}

/** Whether the step onto (x, y) is blocked by a prop: they take their tile. */
export const blocksAgustusan = (x: number, y: number): boolean => {
  if (world.room !== "town") return false;
  const f = festiveNow();
  return f?.id === "agustusan" && isBlocked(x, y, f.days);
};

const at = (s: Spot, x: number, y: number) => s.x === x && s.y === y;

/** E on a prop or a flag. False when it is not one. */
export function agustusanInteract(x: number, y: number): boolean {
  const a = agustusanNow();
  if (!a) return false;
  const now = performance.now();
  if (a.stand.lomba && at(PANJAT, x, y)) {
    say(climbPole(now));
    return true;
  }
  if (a.stand.lomba && at(KERUPUK, x, y)) {
    say(biteKerupuk(now));
    return true;
  }
  if (a.stand.lomba && at(SACK.start, x, y)) {
    say(startRace(now));
    return true;
  }
  if (a.stand.lomba && at(SACK.finish, x, y)) {
    say(
      "🏁 The finish flag. Press E at the start flag on the left of the square, then run the lane to here.",
    );
    return true;
  }
  if (a.stand.tumpeng && at(TUMPENG, x, y)) {
    say(
      a.days === 0
        ? "🍚 Tumpeng! The cone of yellow rice is cut today. The first slice goes to the one who has done the most for the neighbours. Selamat makan!"
        : "🍚 A tumpeng: a cone of yellow rice for syukuran (giving thanks), ringed with side dishes. It is cut on the 17th.",
    );
    return true;
  }
  if (a.stand.gapura && (at(GAPURA.left, x, y) || at(GAPURA.right, x, y))) {
    say(
      `⛩ The gapura: every street paints a gate red and white for the 17th. This one says Dirgahayu RI, long live the Republic, for the ${anniversary(skyNow())}th year of independence.`,
    );
    return true;
  }
  const i = a.flags.findIndex((s) => s.x === x && s.y === y);
  if (i >= 0 && i < a.up) {
    say(
      isUmbul(i)
        ? "🎏 An umbul-umbul: a long pennant on a bamboo pole. They line the streets before the 17th."
        : "🇮🇩 Sang Saka Merah Putih: red for courage, white for purity. Merdeka!",
    );
    return true;
  }
  return false;
}

// MARK: Drawing

/** The tile's bottom edge in world pixels: what a prop is sorted by, as an item in the frame. */
const floorOf = (y: number): number => (y + 1) * TILE;

/** The tile a prop of width `w` sits in, left aligned to centre it on the tile. */
const leftOf = (x: number, w: number): number => x * TILE + (TILE - w) / 2;

export function drawAgustusan(f: Frame): void {
  const a = agustusanNow();
  if (!a) return;
  const { g, items, now } = f;
  watchRace(now);
  const wave = Math.floor(now / 480);

  // Flags: the square's first, then the streets', a few more as the 17th gets closer.
  for (let i = 0; i < a.up; i++) {
    const s = a.flags[i]!;
    const left = leftOf(s.x, 0) + 8 - FLAG_PX.pole;
    const top = floorOf(s.y) - FLAG_PX.h;
    if (!inView(f, left, top, FLAG_PX.w, FLAG_PX.h, TILE)) continue;
    const sprite = flagSprite(isUmbul(i) ? 1 : 0, ((wave + i) % 2) as 0 | 1);
    items.push({ y: floorOf(s.y) - 1, draw: () => g.drawImage(sprite, left, top) });
  }

  if (a.stand.gapura) {
    // Bunting along the square's edges, tied to the poles and the gapura's posts.
    const tie = (s: Spot): [number, number] => {
      const isGate = at(GAPURA.left, s.x, s.y) || at(GAPURA.right, s.x, s.y);
      if (isGate)
        return [
          at(GAPURA.left, s.x, s.y)
            ? GAPURA.left.x * TILE + GAPURA_TIE.left
            : GAPURA.left.x * TILE + GAPURA_TIE.right,
          floorOf(s.y) - GAPURA_PX.h + GAPURA_TIE.y,
        ];
      return [s.x * TILE + 8, floorOf(s.y) - FLAG_PX.h + FLAG_TIE];
    };
    for (const [p, q] of BUNTING_ROWS) {
      const [x0, y0] = tie(p);
      const [x1] = tie(q);
      const sag = 4;
      const sprite = buntingSprite(Math.round(x1 - x0), sag);
      if (!inView(f, x0, y0, sprite.width, sprite.height, TILE)) continue;
      items.push({ y: floorOf(p.y) - 2, draw: () => g.drawImage(sprite, x0, y0) });
    }
    // The gate itself, on the four tiles between and with the posts.
    const left = GAPURA.left.x * TILE;
    const top = floorOf(GAPURA.left.y) - GAPURA_PX.h;
    if (inView(f, left, top, GAPURA_PX.w, GAPURA_PX.h, TILE))
      items.push({ y: floorOf(GAPURA.left.y) - 1, draw: () => g.drawImage(gapuraSprite(), left, top) });
  }

  if (a.stand.lomba) drawLomba(f, a, now);

  if (a.stand.tumpeng) {
    const left = leftOf(TUMPENG.x, TUMPENG_PX.w);
    const top = floorOf(TUMPENG.y) - TUMPENG_PX.h;
    if (inView(f, left, top, TUMPENG_PX.w, TUMPENG_PX.h, TILE))
      items.push({ y: floorOf(TUMPENG.y) - 1, draw: () => g.drawImage(tumpengSprite(), left, top) });
  }
}

/** A pole on a tile: its sign when the player is near. */
function labelOf(f: Frame, s: Spot, top: number, text: string): void {
  const me = self();
  if (!me || Math.abs(me.x - s.x) + Math.abs(me.y - s.y) > 5) return;
  const [sx, sy] = f.toScreen(s.x * TILE + TILE / 2, top);
  f.labels.push(() => sign(f.g, sx, sy - 2 * f.dpr, text, f.dpr, true));
}

function drawLomba(f: Frame, a: AgustusanNow, now: number): void {
  const { g, items } = f;
  // The pole, with the climber on it.
  {
    const left = leftOf(PANJAT.x, POLE_PX.w);
    const top = floorOf(PANJAT.y) - POLE_PX.h;
    if (inView(f, left, top, POLE_PX.w, POLE_PX.h, TILE)) {
      const h = climberHeight(now);
      const showClimber = h > 0 || pole.won > 0;
      items.push({
        y: floorOf(PANJAT.y) - 1,
        draw: () => {
          g.drawImage(poleSprite(), left, top);
          if (showClimber) {
            const feet = POLE_CLIMB.bottom - ((POLE_CLIMB.bottom - POLE_CLIMB.top) * h) / PANJAT_TOP;
            g.drawImage(climberSprite((Math.floor(now / 200) % 2) as 0 | 1), left + 3, top + feet - 11);
          }
        },
      });
      if (a.stand.play) labelOf(f, PANJAT, top, "🧗 Panjat pinang");
    }
  }
  // The kerupuk string, swinging when it has been bitten.
  {
    const left = leftOf(KERUPUK.x, 16);
    const top = floorOf(KERUPUK.y) - 30;
    if (inView(f, left, top, 16, 30, TILE)) {
      const frame = (kerupukBites(now) > 0 ? Math.floor(now / 150) % 2 : 0) as 0 | 1;
      items.push({ y: floorOf(KERUPUK.y) - 1, draw: () => g.drawImage(kerupukSprite(frame), left, top) });
      if (a.stand.play) labelOf(f, KERUPUK, top, "🍘 Makan kerupuk");
    }
  }
  // The sack race: the start and finish flags, and the lane between them.
  for (const [s, kind] of [
    [SACK.start, 0],
    [SACK.finish, 1],
  ] as const) {
    const left = leftOf(s.x, 16);
    const top = floorOf(s.y) - 26;
    if (!inView(f, left, top, 16, 26, TILE)) continue;
    items.push({ y: floorOf(s.y) - 1, draw: () => g.drawImage(laneFlagSprite(kind), left, top) });
    if (a.stand.play) labelOf(f, s, top, kind === 0 ? "🏁 Balap karung" : "🏁 Finish");
  }
  const lx = SACK.laneX0 * TILE;
  const lw = (SACK.laneX1 - SACK.laneX0 + 1) * TILE;
  if (inView(f, lx, SACK.y * TILE, lw, TILE, TILE))
    items.push({
      y: SACK.y * TILE,
      draw: () => {
        // Chalk lines either side of the lane, red and white dashes, and a chequered strip at the end.
        for (let x = 0; x < lw; x += 4) {
          g.fillStyle = (x / 4) % 2 ? "#fbf7ef" : "#d8283a";
          g.fillRect(lx + x, SACK.y * TILE + 1, 3, 1);
          g.fillRect(lx + x, SACK.y * TILE + TILE - 2, 3, 1);
        }
        for (let k = 0; k < 4; k++) {
          g.fillStyle = k % 2 ? "#fbf7ef" : "#2b2433";
          g.fillRect(lx + lw - 3, SACK.y * TILE + 2 + k * 3, 3, 3);
        }
      },
    });
}

// A handle for the QA scripts: set the pole, ask what the build-up is.
if (storage.getItem("tokenmaxxing.qa"))
  Object.assign(window, {
    __agustusan: {
      setClimb: (h: number) => {
        pole = { h, at: performance.now() + 1e9, won: 0 };
      },
      now: agustusanNow,
      medals: medalsWon,
    },
  });
