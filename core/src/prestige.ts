/**
 * Prestige: past level 50 you can choose to start another run (`RUN_LEVELS` levels of `TOKENS_PER_LEVEL` each) for
 * a collection nobody else can have. This file is the catalogue only: five tracks (V is the first release, more
 * will follow), each with a tag (emblem and title), four wearables, a pet accessory and a home trophy. Like the
 * cases' (`case.ts`) the wearables go through `Look` at their own indices from `PRESTIGE_BASE`, so no range ever
 * meets another, but they are never sold, never in a case and cannot change hands. The art is keyed by the same
 * indices and names: `web/src/art/prestige*.ts` in 2D, `web/src/render3d/people/gear3dPrestige*.ts` in 3D.
 * Design: `docs/prestige.md`.
 */
import type { CaseItem, CaseSlot } from "./case.ts";
import type { Rarity } from "./rarity.ts";

/** Look indices from here up to `PRESTIGE_BASE + 99`, in a case slot, are prestige rewards: track n is `+ n - 1`. */
export const PRESTIGE_BASE = 700;

/** Levels in one prestige run, and the lifetime tokens each one takes. */
export const RUN_LEVELS = 50;
export const TOKENS_PER_LEVEL = 1e9;

/** Coins a run pays at its milestone levels; every other level pays `RUN_LEVEL_COINS`. 2,200 a completed run. */
export const RUN_LEVEL_COINS = 10;
export const RUN_MILESTONE_COINS: Readonly<Record<number, number>> = { 10: 100, 20: 200, 30: 300, 40: 400, 50: 750 };

/** The run level each reward unlocks at. Entering a prestige gives the tag (emblem and title) at once. */
export const REWARD_LEVEL = { hat: 10, outfit: 20, petwear: 30, back: 40, aura: 50, trophy: 50 } as const;

export type PrestigeSlot = Extract<CaseSlot, "hat" | "outfit" | "back" | "aura">;

export interface PrestigeTrack {
  /** 1 for Prestige I. */
  rank: number;
  /** Lowercase key, for art and css classes. */
  key: string;
  /** The collection's name, and the title that goes with the emblem. */
  name: string;
  roman: string;
  /** The look in a few words, for the art briefs and the card. */
  theme: string;
  /** Main, second and glow colour of the collection; the tag, the aura and the art all lean on these. */
  colors: { main: string; accent: string; glow: string };
  /** Name of the crest in the tag: a 16×16 sprite in 2D (`web/src/art/prestige-emblem.ts`). */
  emblem: string;
  petwear: { name: string; blurb: string };
  trophy: { name: string; blurb: string; w: number };
}

// A catalogue reads best one track a block.
// prettier-ignore
export const PRESTIGE_TRACKS: readonly PrestigeTrack[] = [
  {
    rank: 1, key: "ascendant", name: "Ascendant", roman: "I",
    theme: "violet and silver: rising light, runes, feathers of light",
    colors: { main: "#8b5cf6", accent: "#d6dbe6", glow: "#c4a8ff" },
    emblem: "Ascendant crest",
    petwear: { name: "Silver pet circlet", blurb: "A thin silver band with one violet stone. Your pet wears it better than you wear yours." },
    trophy: { name: "Ascendant obelisk", blurb: "A violet-veined obelisk that hums a note higher every time someone looks at it.", w: 1 },
  },
  {
    rank: 2, key: "cosmic", name: "Cosmic", roman: "II",
    theme: "cyan and midnight blue: starfields, orbits, small planets",
    colors: { main: "#22d3ee", accent: "#14214d", glow: "#8cf0ff" },
    emblem: "Cosmic crest",
    petwear: { name: "Starlight pet collar", blurb: "A midnight collar with a tag that is, on inspection, a real star." },
    trophy: { name: "Miniature orrery", blurb: "Six tiny worlds on brass arms, all of them on a first-name basis with your balance.", w: 2 },
  },
  {
    rank: 3, key: "voidwalker", name: "Voidwalker", roman: "III",
    theme: "obsidian and magenta: event horizons, rifts, light bending round dark",
    colors: { main: "#d946ef", accent: "#17101f", glow: "#ff7cf5" },
    emblem: "Voidwalker crest",
    petwear: { name: "Eclipse pet crown", blurb: "A black disc ringed in magenta fire, floating just over their head." },
    trophy: { name: "Contained black hole", blurb: "Held in a glass cell. The sign says do not feed it, so everyone does.", w: 1 },
  },
  {
    rank: 4, key: "architect", name: "Architect", roman: "IV",
    theme: "ivory and gold: blueprints, clockwork, drafting lines, built worlds",
    colors: { main: "#f5e6b8", accent: "#d4a017", glow: "#ffe38a" },
    emblem: "Architect crest",
    petwear: { name: "Clockwork pet halo", blurb: "A gold ring of tiny turning gears, always a minute ahead of schedule." },
    trophy: { name: "Holographic town", blurb: "Your town in blueprint gold, every tiny citizen blinking in time.", w: 2 },
  },
  {
    rank: 5, key: "prismatic", name: "Prismatic", roman: "V",
    theme: "every colour at once over pearl: refracted light, rainbow edges, aurora",
    colors: { main: "#f4f0ff", accent: "#ff7ad9", glow: "#9fe8ff" },
    emblem: "Prismatic crest",
    petwear: { name: "Prismatic pet crown", blurb: "Pearl points that throw a different colour with each step." },
    trophy: { name: "Prismatic token monument", blurb: "A pearl token the height of a person, splitting the light into everything you earned.", w: 2 },
  },
];

const item = (
  track: PrestigeTrack,
  slot: PrestigeSlot,
  name: string,
  rarity: Rarity,
  blurb: string,
): CaseItem => ({
  id: `${slot}.${PRESTIGE_BASE + track.rank - 1}`,
  slot,
  index: PRESTIGE_BASE + track.rank - 1,
  name,
  price: 0,
  tradeable: false,
  rarity,
  blurb,
  case: true,
});

// A catalogue reads best one item a line.
// prettier-ignore
const NAMES: readonly [hat: string, outfit: string, back: string, aura: string][] = [
  ["Ascendant visor", "Ascendant robes", "Runic cape", "Ascending sparks"],
  ["Starfield crown", "Nebula suit", "Orbital backpack", "Orbiting token sigil"],
  ["Event-horizon visor", "Voidwalker armour", "Rift mantle", "Event-horizon ring"],
  ["Architect's diadem", "Worldbuilder regalia", "Lattice wings", "Orbiting wireframe"],
  ["Prismatic crown", "Prismatic regalia", "Aurora wings", "Prismatic ascension"],
];

// prettier-ignore
const BLURBS: readonly [hat: string, outfit: string, back: string, aura: string][] = [
  ["A violet visor edged in silver. Whatever it shows you, you saw it first.", "Long violet robes with silver runes that glow when you stand still.", "A silver-lined cape with a rune on every hem that lights as you walk.", "Violet sparks rise off you and never seem to come down."],
  ["A crown of tiny stars that is always, somehow, night over your head.", "A midnight suit with a nebula swirling across the chest.", "A little orbital rig: two moons and a ringed planet, circling your shoulders.", "A cyan token sigil turns slowly round you with three tokens in orbit."],
  ["A black visor with a bright ring of bent light round the lens.", "Obsidian plates with magenta fault lines, cold to the touch.", "A mantle torn from a rift, edges still crackling magenta.", "A slow ring of bent light, with a dark heart where you stand."],
  ["A thin ivory diadem with a drafting-compass tip and gold measuring ticks.", "Ivory and gold regalia drawn on like a blueprint, with a rolled plan on the belt.", "Wings of gold lattice, every strut dimensioned and labelled.", "A wireframe of gold lines orbits you, redrawing itself as it goes."],
  ["Pearl points, each one throwing a different colour of the spectrum.", "Pearl regalia that shows every colour but never the same one twice.", "Wings of folded aurora, green to violet to pink along each feather.", "A column of every colour at once rises round you and splits to rainbow at the top."],
];

/** Never reorder or reuse: the ids are in bags. A new track adds its four on the end. */
export const PRESTIGE_ITEMS: readonly CaseItem[] = PRESTIGE_TRACKS.flatMap((t, i) => [
  item(t, "hat", NAMES[i]![0], "epic", BLURBS[i]![0]),
  item(t, "outfit", NAMES[i]![1], "epic", BLURBS[i]![1]),
  item(t, "back", NAMES[i]![2], "epic", BLURBS[i]![2]),
  item(t, "aura", NAMES[i]![3], "legendary", BLURBS[i]![3]),
]);

export const isPrestigeItem = (id: string): boolean => PRESTIGE_ITEMS.some((i) => i.id === id);

/** The track whose wearables sit at look index `index`, if it is one. */
export const trackAt = (index: number): PrestigeTrack | undefined =>
  index >= PRESTIGE_BASE && index < PRESTIGE_BASE + 100 ? PRESTIGE_TRACKS[index - PRESTIGE_BASE] : undefined;

/** The tag shown beside a name: "Prestige III · Voidwalker". */
export const prestigeTag = (rank: number): string => {
  const t = PRESTIGE_TRACKS[rank - 1];
  return t ? `Prestige ${t.roman} · ${t.name}` : "";
};

/** Coins a run level pays (a milestone's replaces the ordinary 10). */
export const runLevelCoins = (level: number): number => RUN_MILESTONE_COINS[level] ?? RUN_LEVEL_COINS;
