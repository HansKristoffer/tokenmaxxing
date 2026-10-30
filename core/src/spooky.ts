/**
 * Halloween's spooky night, the theme layered over the pumpkins (`halloween.ts`): Gerda the gravekeeper, the
 * cauldron, the extra tombstones, ghosts, bats, cobwebs, candy, and trick-or-treat at the doorsteps. Pure and
 * clock-and-map driven, like the pumpkins: the server keeps nothing. The 2D town draws it
 * (`web/src/game/spooky.ts`), the 3D town builds it (`web/src/render3d/town/halloween3d.ts`), and both ask
 * `festiveNow()?.id === "halloween"` whether it's on.
 */
import type { FestiveNpc } from "./festive.ts";
import { PATCH } from "./halloween.ts";
import { worldWall } from "./range.ts";

// MARK: Where things stand (town tiles, all on grass; core/test/spooky.test.ts checks)

/**
 * Gerda's tile: on the west lawn, two tiles off the road beside the square, so both cameras see her (the graveyard
 * itself hides behind the Tavern and the windmill in 3D). Open grass on every side, so she's in nobody's way.
 * Face her and press E.
 */
export const GERDA_TILE = { x: -3, y: 5 } as const;

/** The cauldron on the grass in front of the Tavern, below its path. */
export const CAULDRON = { x: 11, y: 17 } as const;

export type StoneKind = "round" | "cross" | "slab";

/** Gerda's own little plot of stones beside her, for the models nobody has retired yet: scenery (a click-route may cross them). */
export const EXTRA_STONES: readonly { x: number; y: number; kind: StoneKind; text: string }[] = [
  { x: -6, y: 6, kind: "cross", text: "BRB" },
  { x: -4, y: 6, kind: "round", text: "404" },
  { x: -5, y: 7, kind: "slab", text: "TODO" },
  { x: -7, y: 7, kind: "round", text: "RIP npm" },
];

/** Whether Gerda or the cauldron stands on this tile: they block a step (the stones and sweets are scenery). */
export const spookyBlocks = (x: number, y: number): boolean =>
  (x === GERDA_TILE.x && y === GERDA_TILE.y) || (x === CAULDRON.x && y === CAULDRON.y);

/** The ghosts that drift on the spot: an ellipse around (x, y) in tiles, a lap every `period` seconds. */
export interface Haunt {
  x: number;
  y: number;
  rx: number;
  ry: number;
  period: number;
  phase: number;
  /** A baby ghost is smaller. */
  size: number;
  /** Ghost white, or the blue one. */
  hue: "white" | "blue";
}

export const HAUNTS: readonly Haunt[] = [
  // The graveyard.
  { x: 17, y: 11.3, rx: 2.4, ry: 1, period: 22, phase: 0, size: 1, hue: "white" },
  // Over the pond.
  { x: 4.5, y: 13.4, rx: 1.4, ry: 1.3, period: 17, phase: 2, size: 0.7, hue: "blue" },
  // Outside the Tavern.
  { x: 9, y: 17.6, rx: 1.6, ry: 0.8, period: 19, phase: 4, size: 0.85, hue: "white" },
  // By Gerda's stones.
  { x: -5.5, y: 5, rx: 1.5, ry: 1, period: 21, phase: 1, size: 0.75, hue: "white" },
];

/** Where a haunt's ghost is at `t` seconds (tiles), and how high it floats (tiles). */
export function ghostAt(h: Haunt, t: number): { x: number; y: number; lift: number } {
  const a = (t / h.period) * Math.PI * 2 + h.phase;
  return {
    x: h.x + Math.cos(a) * h.rx,
    y: h.y + Math.sin(a) * h.ry,
    lift: 0.25 + Math.sin(t * 1.3 + h.phase) * 0.08,
  };
}

/** The bats' roosts (tile centres they circle: the Tavern's roof, the windmill, the graveyard and Gerda's lawn). */
const ROOSTS: readonly (readonly [number, number])[] = [
  [13.5, 13.5],
  [18.9, 16],
  [17, 11],
  [-3.5, 4.5],
];

/** How many bats flap about at this build-up: 4 on the first evening, 8 at the peak. */
export const batCount = (intensity: number): number =>
  Math.round(4 + 4 * Math.min(1, Math.max(0, (intensity - 0.5) * 2)));

/** Where bat `i` is at `t` seconds: tiles, and its height in tiles; `flap` goes round once per wingbeat. */
export function batAt(i: number, t: number): { x: number; y: number; h: number; flap: number } {
  const [cx, cy] = ROOSTS[i % ROOSTS.length]!;
  const speed = 0.35 + (i % 3) * 0.08;
  const a = t * speed + i * 2.399;
  const r = 2.6 + (i % 4) * 0.7;
  return {
    x: cx + Math.sin(a) * r,
    y: cy + Math.sin(a * 2) * r * 0.42,
    h: 2.7 + (i % 3) * 0.45 + Math.sin(t * 0.9 + i) * 0.2,
    flap: t * 13 + i * 1.7,
  };
}

/** Sweets scattered about the pumpkin patch and under the cauldron: tile coordinates (with a fraction) and a colour 0..3. */
export const CANDY_SPOTS: readonly { x: number; y: number; c: number }[] = [
  ...PATCH.flatMap(([x, y], k) => [
    { x: x + 0.15, y: y + 0.82, c: k % 4 },
    { x: x + 0.78, y: y + 0.7, c: (k + 1) % 4 },
    { x: x + 0.5, y: y + 0.95, c: (k + 2) % 4 },
  ]),
  { x: CAULDRON.x + 0.1, y: CAULDRON.y + 0.85, c: 0 },
  { x: CAULDRON.x + 0.85, y: CAULDRON.y + 0.75, c: 2 },
  { x: CAULDRON.x + 0.6, y: CAULDRON.y + 0.95, c: 3 },
];

/** The sweets' colours: pink, yellow, blue, chocolate. */
export const CANDY_COLORS = ["#ff4fa3", "#ffe14a", "#4fd1ff", "#8a3b12"] as const;

// MARK: Trick-or-treat

/** What a doorstep gives: a sweet, a handful, a trick (harmless), or nobody home. */
export type Treat = "candy" | "big" | "trick" | "nobody";

/** Candy in the bucket for each. */
export const TREAT_CANDY: Record<Treat, number> = { candy: 1, big: 3, trick: 0, nobody: 0 };

const hashOf = (s: string): number => [...s].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);

/** The door's key in storage and in the hash: its tile. */
export const doorKey = (door: readonly [number, number]): string => `${door[0]},${door[1]}`;

/** The world day (Copenhagen) `ms` is in, as `2026-10-31`. */
export function dayKey(ms: number): string {
  const { y, m, d } = worldWall(ms);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Deterministic: the same door on the same day gives the same thing to everyone. 55% candy, 15% a handful, 20% a trick, 10% nobody. */
export function treatAt(door: string, day: string): Treat {
  const h = hashOf(`${day}|${door}`) % 100;
  return h < 55 ? "candy" : h < 70 ? "big" : h < 90 ? "trick" : "nobody";
}

const SAYS: Record<Treat, readonly string[]> = {
  candy: [
    "A neighbour hands you a salty liquorice. A local speciality. You pretend to love it.",
    "The door opens a crack. A lemon sweet drops in your bucket. The door closes.",
    "A kid in a bedsheet is already inside, but there is a sweet left for you.",
    "A bowl on the step says TAKE ONE. You take one. Responsible.",
  ],
  big: [
    "Jackpot! A whole handful of wrapped sweets, thrown in with both hands.",
    "The neighbour loves Halloween. Three sweets, a wink, and a bad pun about boo-ks.",
    "They have been saving these since September. Three sweets for you.",
  ],
  trick: [
    "A plastic spider drops from the awning. You scream. It was plastic. Probably.",
    "BOO! A ghost-shaped neighbour pops out and holds up a sign: NO SWEETS, ONLY JOKES.",
    "The pumpkin winks at you. No sweets. You decide not to talk about it.",
  ],
  nobody: [
    "Nobody home. The candle in the pumpkin flickers anyway.",
    "A note on the door: BACK IN 5 MINUTES (they lie).",
  ],
};

/** The line for a knock: stable per door and day. */
export const treatSays = (t: Treat, door: string, day: string): string => {
  const lines = SAYS[t];
  return lines[hashOf(`${door}|${day}|say`) % lines.length]!;
};

/** What the cauldron says when you stir it (a new one each time, in turn). */
export const STIR_LINES = [
  "You stir. It bubbles back, annoyed. Smells like burnt cache.",
  "The brew glows a toxic green. Something in it says 'retry later'.",
  "A bubble pops and whispers: 'have you tried turning it off and on again?'",
  "You stir three times widdershins. Nothing happens. You feel watched.",
  "It's a cauldron of green soup. Gerda says it is a vegan stew. Gerda lies.",
] as const;

// MARK: Gerda

/** The Halloween NPC (`FESTIVE_NPC.halloween`): the keeper of the model graveyard, in her good cloak. */
export const GERDA: FestiveNpc = {
  id: "gerda",
  name: "Gerda, gravekeeper",
  x: GERDA_TILE.x,
  y: GERDA_TILE.y,
  facing: "right",
  lines: [
    "Boo! I'm Gerda, keeper of the model graveyard. Two nights a year the dead come visiting, so I put on my good cloak.",
    "Halloween began as Samhain, the old Celtic end-of-harvest night, when the veil between the living and the dead went thin. People carved turnips, lit them and put them on the step to guide the friendly spirits and scare off the rest.",
    "The turnips became pumpkins when the Irish took the custom to America, and now Aarhus has them too. See the jack-o'-lanterns on the doorsteps? They light up with the street lamps.",
    "Denmark's own dress-up-and-sweets day is fastelavn, in February, with the barrel and the buns. Halloween is the newcomer, but this town adopts anything involving candy.",
    "Trick-or-treat! Stand next to a doorstep with a jack-o'-lantern, face it and press E to knock. Each door opens once a day: some give a sweet, some a handful, some a trick, and some nobody's home.",
    "Your candy goes in the bucket at the top of your screen, and it counts the doors you've knocked on today. Knock on every door and you're the sugar king, or queen. It's only for bragging.",
    "That green bubbling cauldron on the grass by the Tavern? Face it and press E to give it a stir. I wouldn't drink it. Jens did, and now he's very green. Not really. We checked.",
    "The graveyard is for retired AI models: deprecated, never forgotten. I carve the epitaphs myself. The stones in my corner of the lawn here are for the ones nobody has retired yet.",
    "The ghosts drift near the graveyard, the pond and the Tavern. The bats come at dusk, and they get thicker the closer it gets to the 31st. All friendly. The bats, anyway.",
    "The Clothes shop has the Witch hat, the Ghost sheet and the Bat ears, and the Jack-o'-lantern too, until two days after Halloween. Pick one and the whole town will know you meant it.",
    "It all ends at midnight on the 31st. Poof. The pumpkins stay till November, but the ghosts don't. Happy Halloween!",
  ],
};
