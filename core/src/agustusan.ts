/**
 * Agustusan (10 to 17 August, `festive.ts`): Indonesia's Independence Day, 17 August 1945. The town hangs out the
 * merah putih (red and white): flags and umbul-umbul along the square and the roads, a gapura gate on the square's
 * south side, bunting between the poles; from the 14th the lomba (the neighbourhood's games) are set up: a panjat
 * pinang pole, a kerupuk string and a sack-race lane; from the 16th a tumpeng. All from the clock and the map,
 * the server keeps nothing. The 2D town is `web/src/game/agustusan.ts`, the 3D one `render3d/town/agustusan3d.ts`.
 */
import type { FestiveNpc } from "./festive.ts";
import type { GameMap } from "./maps.ts";
import { worldWall } from "./range.ts";

export interface Spot {
  x: number;
  y: number;
}

/** Pak RT's tile: the east side of the square, clear of the paths, the fountain and the merchant's and pølse carts (x 16 and up), facing west. */
export const NPC_TILE: Spot = { x: 12, y: 5 };

/** The gapura's two posts, on the square's south edge; the gate spans the four tiles between and including them. */
export const GAPURA = { left: { x: 8, y: 8 }, right: { x: 11, y: 8 } } as const;

/** The greased pole, the kerupuk string, the tumpeng table: one tile each, and nobody walks through them. */
export const PANJAT: Spot = { x: 13, y: 7 };
export const KERUPUK: Spot = { x: 4, y: 7 };
export const TUMPENG: Spot = { x: 15, y: 4 };

/** The sack race: the start flag, the lane along this row, and the finish flag (reach the tile before it to win). */
export const SACK = { start: { x: 2, y: 6 }, finish: { x: 10, y: 6 }, laneX0: 3, laneX1: 9, y: 6 } as const;

/** The flag poles on the square's top and bottom edges, in the order they go up. */
export const SQUARE_FLAGS: readonly Spot[] = [
  { x: 3, y: 1 },
  { x: 5, y: 8 },
  { x: 9, y: 1 },
  { x: 15, y: 8 },
  { x: 15, y: 1 },
  { x: 2, y: 8 },
  { x: 6, y: 1 },
  { x: 12, y: 1 },
  { x: 17, y: 1 },
  { x: 18, y: 8 },
];

/** Strings of bunting between those poles and the gapura's posts (ends are tiles on the square). */
export const BUNTING_ROWS: readonly (readonly [Spot, Spot])[] = [
  [
    { x: 3, y: 1 },
    { x: 6, y: 1 },
  ],
  [
    { x: 6, y: 1 },
    { x: 9, y: 1 },
  ],
  [
    { x: 9, y: 1 },
    { x: 12, y: 1 },
  ],
  [
    { x: 12, y: 1 },
    { x: 15, y: 1 },
  ],
  [
    { x: 15, y: 1 },
    { x: 17, y: 1 },
  ],
  [
    { x: 2, y: 8 },
    { x: 5, y: 8 },
  ],
  [
    { x: 5, y: 8 },
    { x: 8, y: 8 },
  ],
  [
    { x: 11, y: 8 },
    { x: 15, y: 8 },
  ],
  [
    { x: 15, y: 8 },
    { x: 18, y: 8 },
  ],
];

/** What stands at `days` from 17 August (-7 .. 0). */
export interface Standing {
  /** Flags and umbul-umbul along the streets: from the first day. */
  flags: boolean;
  /** The gapura and the bunting: from the 12th. */
  gapura: boolean;
  /** The lomba's props: from the 14th. */
  lomba: boolean;
  /** The lomba can be played: from the 15th. */
  play: boolean;
  /** The tumpeng, cut on the 17th (set out from the 16th). */
  tumpeng: boolean;
}

export const standing = (days: number): Standing => ({
  flags: true,
  gapura: days >= -5,
  lomba: days >= -3,
  play: days >= -2,
  tumpeng: days >= -1,
});

/** The tiles the props take: nobody walks through them (the NPC's is the framework's). */
export function blockedTiles(days: number): Spot[] {
  const s = standing(days);
  const out: Spot[] = [];
  if (s.gapura) out.push(GAPURA.left, GAPURA.right);
  // The start flag is at the lane's edge (E on it starts the race); the finish one you run past.
  if (s.lomba) out.push(PANJAT, KERUPUK, SACK.start);
  if (s.tumpeng) out.push(TUMPENG);
  return out;
}

export const isBlocked = (x: number, y: number, days: number): boolean =>
  blockedTiles(days).some((s) => s.x === x && s.y === y);

/** The nth Independence Day, in the world's year (1945 was the first year: 2026 is the 81st). */
export const anniversary = (ms: number): number => worldWall(ms).y - 1945;

/** Roads' grass verge, one row off an E-W road, where the street flags stand (not the one under the square: a pole there stands in front of the camera). */
const VERGE_ROWS = [-1, 17, 19, 26] as const;

/**
 * Every flag pole in town, in the order they go up: the square's first, then the streets' (a flag every fourth tile
 * of lawn along the verge of four roads, in a fixed shuffle). Map-driven: only plain grass, so none
 * stands on a path, a tree, a flower bed or a house.
 */
export function flagSpots(map: GameMap): Spot[] {
  const street: Spot[] = [];
  for (const y of VERGE_ROWS)
    for (let x = map.x0 + 2; x < map.x0 + map.width - 2; x++)
      if (x % 4 === 0 && map.at(x, y) === "." && map.kind(x, y).walk) street.push({ x, y });
  // A fixed shuffle (a multiplicative hash), so the streets fill in all over town rather than from one end.
  street.sort((a, b) => ((a.x * 73 + a.y * 151) % 97) - ((b.x * 73 + b.y * 151) % 97));
  return [...SQUARE_FLAGS, ...street];
}

/** How many of `total` flags are up at this intensity: a few at first, all of them by the 17th. */
export const flagsUp = (total: number, intensity: number): number =>
  Math.min(total, Math.max(SQUARE_FLAGS.length, Math.ceil(total * intensity)));

/** Which kind of flag a pole carries: the bendera (a flag) or the umbul-umbul (a long pennant). */
export const isUmbul = (i: number): boolean => i % 3 === 2;

// MARK: The lomba

/** Panjat pinang: climb 10 steps up the greased pole; each press of E is a try that slips back one in three. */
export const PANJAT_TOP = 10;
/** The chance a try gets a step higher. */
export const PANJAT_GRIP = 0.62;
/** Without a press for this long, the climber slides down a step a second. */
export const PANJAT_SLIDE_MS = 1100;

/** Where a climber at `h` ends up after a try with `roll` in [0, 1). */
export const climb = (h: number, roll: number): number =>
  roll < PANJAT_GRIP ? Math.min(PANJAT_TOP, h + 1) : Math.max(0, h - 1);

/** Makan kerupuk: take this many bites, each within this long of the last (hands behind your back; it swings). */
export const KERUPUK_BITES = 6;
export const KERUPUK_GAP_MS = 1400;

/** Balap karung: from the start flag to the finish, along the lane, within this long to win a medal. */
export const SACK_TILES = SACK.laneX1 - SACK.laneX0 + 2;
export const SACK_PAR_MS = 4200;

/** The three medals a player can win in a year. */
export type Lomba = "panjat" | "kerupuk" | "karung";
export const LOMBA_NAMES: Record<Lomba, string> = {
  panjat: "Panjat pinang",
  kerupuk: "Makan kerupuk",
  karung: "Balap karung",
};

/** Pak RT, the neighbourhood head. Each line is one press of E. */
export const AGUSTUSAN_NPC: FestiveNpc = {
  id: "agustusan",
  name: "Pak Budi (RT 05)",
  ...NPC_TILE,
  facing: "down",
  lines: [
    "Selamat datang, nak! I am Pak Budi, the RT: the head of this little neighbourhood. In Indonesia every street has one, and every August we make the whole town merah putih, red and white.",
    "The 17th of August is Hari Kemerdekaan. On that day in 1945, in Jakarta, Sukarno and Mohammad Hatta read the Proclamation: 'We, the people of Indonesia, hereby declare the independence of Indonesia.' The paper was typed that morning and signed in a hurry.",
    "The flag they raised was sewn by Fatmawati, Sukarno's wife: two stripes, red on top for courage, white below for purity. We call it Sang Saka Merah Putih. Every pole in town flies it this week, and the long thin ones are umbul-umbul.",
    "See the gapura on the south side of the square? Every street builds a gate like it, painted red and white, with how many years we are free written on it. Dirgahayu Republik Indonesia! Dirgahayu means long live.",
    "Tumpeng! The yellow rice cone is for syukuran, giving thanks. From the 16th it stands on the table by the square, and the first slice goes to the one the community loves most (that is usually the RT, but I am being humble).",
    "From the 15th, the lomba: games for everyone, the grown-ups too! Panjat pinang is the greased pole just along from me, in the middle of the square. Press E facing it again and again to climb; the grease makes you slip back. Reach the top, take the prizes, win a medal.",
    "Makan kerupuk: the cracker on a string, hands behind your back. Face the string, press E to bite, and keep biting. Too slow and it swings away from you. Six bites and the medal is yours.",
    "Balap karung is the sack race. Press E at the start flag on the left of the square, then run the lane to the finish flag. In the old days we did it in a real rice sack! The medals are yours to keep this year.",
    "Panjat pinang started under the Dutch, you know: they greased the poles for fun and watched us climb for the prizes. Now we do it for ourselves, and the prize at the top is for everyone to share.",
    "Tarik tambang, the tug of war, is next year: the rope is still at the kampung. But the music, the flags, the red and white headband from the Clothes shop, and a peci for the proud: all here until the evening of the 17th.",
    "Merdeka! Hand on heart: that is how we say it. One more thing, nak: take a medal home. It is not the pole we are celebrating. It is that we climbed it together.",
  ],
};
