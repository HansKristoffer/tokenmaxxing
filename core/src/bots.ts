/**
 * Town characters: bots that wander the town and say something now and then. To add one, add it to
 * `BOTS`; the `world` actor walks it and makes it talk. Ids are negative, so they never meet a real
 * user's (those start at 1).
 */
import type { GameMap } from "./maps.ts";
import { type Facing, type Look, route } from "./world.ts";

export interface BotDef {
  /** Negative and unique. */
  id: number;
  name: string;
  look: Look;
  level: number;
  /** Shown on its card. */
  bio: string;
  /** Said at random, one every `every[0]` to `every[1]` ms while someone is around to hear it. */
  lines: string[];
  every: [number, number];
}

export const BOTS: BotDef[] = [
  {
    id: -1,
    name: "Seb - AROX",
    look: { style: 1, skin: 0, hair: 2, outfit: 5, glasses: 1, hat: 0, pet: 0 },
    level: 99,
    bio: "Står bag Arox (arox.dk): grips, sjippetove og knee sleeves til CrossFit. Har set verdens undergang komme siden første ordre. Pakker stadig ordrer kl. 22.",
    lines: [
      "Verden går under, og folk spørger stadig, om grips kan fås i pink.",
      "Vi arbejder alt for meget. Selv vores sjippetove får flere pauser end os.",
      "GLS siger 1-3 dage. Jeg siger: verden har ikke 3 dage tilbage.",
      "Fri fragt over 499,-. Fri weekend? Aldrig hørt om det.",
      "Annoncepriserne på Meta stiger hurtigere end havvandet.",
      "Black Friday er bare et andet ord for undergang.",
      "Endnu en retur på et par knee sleeves. 'Passede ikke.' Ingen passer i den her verden.",
      "Fem år med Arox. Fem år uden ferie.",
      "Hold fast i selv den glatteste pull-up bar. Og i jeres mentale helbred.",
      "Lageret er fyldt med speed ropes. Mit liv er fyldt med deadlines.",
      "Sverige, Tyskland... snart sælger vi grips på Mars, når Jorden er færdig.",
      "Dansk udviklet udstyr. Dansk udviklet stress.",
      "Over 30.000 glade kunder. Én ekstremt træt Seb.",
      "Hvem har tid til at træne? Jeg sælger bare udstyret til det.",
      "Konverteringsraten falder, polerne smelter, og printeren til logotryk er gået i stykker igen.",
      "Jeg drømte om pakkelabels i nat. Igen.",
      "Klokken er 17. Luk webshoppen. Nej, vent, den lukker aldrig.",
      "Kunderne vil have levering i går. Jeg vil have en lur i går.",
      "Bliv B2B forhandler, siger de. Bliv udbrændt, siger jeg.",
      "Fra idé til virkelighed. Fra virkelighed til kollaps.",
      "En kunde skrev 'haster' i ordrenoten. ALT haster. Alt er ved at gå under.",
      "Tape, sweatbands, lifting straps. Alt hvad man skal bruge for at holde sammen på sig selv.",
      "Lagerstyring er bare at se kaos i øjnene hver morgen.",
      "Telefontid 12-15? Jeg tager telefonen 24/7. Det er problemet.",
    ],
    every: [45_000, 150_000],
  },
];

export const isBot = (id: number): boolean => id < 0;

/** Uniformly between `min` and `max`. */
export const between = ([min, max]: readonly [number, number], rand = Math.random): number =>
  min + (max - min) * rand();

export const pick = <T>(list: readonly T[], rand = Math.random): T => list[Math.floor(rand() * list.length)]!;

/**
 * A walk to a random open tile within `reach` tiles of (x, y). Routes only cross walkable tiles, so a
 * wandering bot never walks through a door. Null when the tile picked is blocked or out of reach;
 * try again next time.
 */
export function wander(map: GameMap, x: number, y: number, reach = 12, rand = Math.random): Facing[] | null {
  const tx = x + Math.round((rand() * 2 - 1) * reach);
  const ty = y + Math.round((rand() * 2 - 1) * reach);
  if ((tx === x && ty === y) || !map.walkable(tx, ty)) return null;
  return route(map, [x, y], [tx, ty]);
}

/** The next step towards someone at (tx, ty), stopping next to them. Null once there, or with no way there. */
export function chase(map: GameMap, x: number, y: number, tx: number, ty: number): Facing | null {
  if (Math.abs(tx - x) + Math.abs(ty - y) <= 1) return null;
  return route(map, [x, y], [tx, ty])?.[0] ?? null;
}
