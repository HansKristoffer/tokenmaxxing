/**
 * Befrielsen, 4 and 5 May (`festive.ts`, `holidays.ts`): the evening Denmark was freed in 1945. A quiet, warm
 * holiday: a candle in every window after dusk (the blackout curtains came down on the 4th), Dannebrog flags, and a
 * small memorial on the lawn west of the square where anyone may light a candle. One old man there remembers.
 *
 * Pure: the places and the words. The picture is `web/src/art/befrielsen.ts` (2D) and
 * `web/src/render3d/town/befrielsen3d.ts` (3D); the 2D game's part is `web/src/game/befrielsen.ts`.
 */
import type { FestiveNpc } from "./festive.ts";

/**
 * The memorial: a low wall with the stele and a candle tray, on the paving in the square's west half (tiles, w x h).
 * Inside the square, never on a company's block (`maps.ts` `frontier`), off the paving's edge where the sprint
 * race runs, and clear of the launch stand, the cart, the statue and the fountain.
 */
export const MEMORIAL = { x: 2, y: 6, w: 3, h: 2 } as const;

/** Where the storyteller stands: the paving at the memorial's east end, looking along it. */
export const NPC_TILE = { x: 5, y: 7 } as const;

/** Dannebrog flagpoles: two behind the memorial, two on the east side of the square. Each blocks its tile. */
export const FLAGPOLES: readonly { x: number; y: number }[] = [
  { x: 2, y: 5 },
  { x: 4, y: 5 },
  { x: 18, y: 2 },
  { x: 18, y: 7 },
];

/** Candles on the memorial tray: the town's, filling from the left, and the player's own, from the right. */
export const CANDLE_SLOTS = 14;
/** How many candles one player lights (a year). */
export const MAX_MINE = 4;

/** Candles the town has lit on the tray at a build-up (`intensity`, 0..1): 6 at the start, 10 on the evening. */
export const townCandles = (intensity: number): number =>
  Math.min(CANDLE_SLOTS - MAX_MINE, Math.round(3 + 7 * Math.min(1, Math.max(0, intensity))));

export const inMemorial = (x: number, y: number): boolean =>
  x >= MEMORIAL.x && x < MEMORIAL.x + MEMORIAL.w && y >= MEMORIAL.y && y < MEMORIAL.y + MEMORIAL.h;

/** Whether a tile is taken by the memorial, a flagpole or the storyteller. */
export const isBefrielsenSolid = (x: number, y: number): boolean =>
  inMemorial(x, y) || (x === NPC_TILE.x && y === NPC_TILE.y) || FLAGPOLES.some((p) => p.x === x && p.y === y);

/** What the memorial says as each of your candles is lit, in turn. */
export const CANDLE_LINES: readonly string[] = [
  "🕯️ A candle for those who stood up in the dark years, 1940 to 1945. Vi husker.",
  "🕯️ A candle for the fishermen who sailed strangers over the Sound to safety in October 1943.",
  "🕯️ A candle for everyone who waited behind a blackout curtain for this evening.",
  "🕯️ A candle for the ordinary kindness that hid people, carried messages and kept quiet.",
];

/** E on the memorial once your candles are all lit. */
export const CANDLES_FULL =
  "🕯️ Your candles burn with the town's. The stone says 1940-1945, and under it, small: Lys i vinduet. Light in the window.";

/** What the memorial says before it is the day (it is only built while the theme is on, so rarely seen). */
export const MEMORIAL_PLAQUE = "1940-1945";

const HENNING_LINES: string[] = [
  "Goddag. Sit a while by the candles. This is the 4th of May, the night Denmark was given back to itself.",
  "On a morning in April 1940 the Germans simply drove in. The government chose to bow rather than see Copenhagen bombed. Five years followed: ration cards, radios turned low.",
  "In the war every window had a blackout curtain, so that no light showed to the bombers. A lit window was a thing you were not allowed to have. Remember that, when you see them tonight.",
  "At half past eight on the evening of 4 May 1945 the BBC read out the news: the German forces in Denmark had surrendered. People were singing in the streets before the man finished. The curtains came down, and candles went in every window.",
  "Not everyone lived to see it. Saboteurs, couriers, neighbours who hid neighbours, and the fishermen who ferried Jewish families to Sweden in October 1943. The stone is for all of them.",
  "I was nineteen, with a bicycle and a bag. I carried papers, nothing heroic. A flat cap and a closed mouth did most of the work.",
  "On the 5th, the British soldiers came, and Denmark was free. We fly the Dannebrog and are quiet and glad in the same breath. No fireworks tonight: only light.",
  "You can light a candle yourself: stand at the stone and press E. Up to four of yours will burn on the tray with the town's.",
  "Walk round after dark and look at the windows. Every house has one. That is how we say Lys i vinduet: a light in the window.",
  "The Clothes shop has a flat cap like mine and a little window candle for your hat, round now and a few days after. Wear one tonight and you will look like you belong.",
];

/** The storyteller: an old resistance man, at the memorial. The slot in `FESTIVE_NPC` (`festive.ts`). */
export const HENNING: FestiveNpc = {
  id: "henning",
  name: "Henning",
  x: NPC_TILE.x,
  y: NPC_TILE.y,
  facing: "left",
  lines: HENNING_LINES,
};
