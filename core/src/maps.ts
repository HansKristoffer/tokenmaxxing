/**
 * The world's maps as character grids. The client draws them and the server
 * checks steps against them, so every tile is defined exactly once, here.
 * One character per tile; `LEGEND` says what it is.
 */

export type MapId = "town" | "hq" | "inn";
export type SeatKind = "bench" | "sofa" | "bed" | "chair";

export interface TileKind {
  name: string;
  walk?: true;
  /** Space while facing it sits you down (beds lie you down). */
  seat?: SeatKind;
  /** Stepping into it changes room. */
  portal?: true;
  /** Shown when you press Space facing it. */
  text?: string;
}

const PLOT: TileKind = { name: "door", portal: true };

export const LEGEND: Record<string, TileKind> = {
  ".": { name: "grass", walk: true },
  ",": { name: "path", walk: true },
  ":": { name: "plaza", walk: true },
  '"': { name: "flowers", walk: true },
  _: { name: "floor", walk: true },
  "=": { name: "rug", walk: true },
  T: { name: "tree", text: "A tree. It has seen a lot of deploys." },
  "~": { name: "water", text: "The water is calm. Someone dropped a USB stick in there." },
  "^": { name: "bush", text: "Just a bush. It rustles." },
  L: { name: "lamp", text: "The lamp hums quietly. It's always on, like a good server." },
  F: { name: "fountain", text: "A fountain. People toss spare tokens in for luck." },
  N: { name: "board", text: "The leaderboard." },
  B: { name: "bench", seat: "bench", text: "A bench with a view of the square." },
  H: { name: "building" },
  W: { name: "wall" },
  b: { name: "bed", seat: "bed", text: "A bed. Unmade. Someone shipped late last night." },
  d: { name: "desk", text: "A laptop covered in stickers. Four agents are still running." },
  c: { name: "chair", seat: "chair", text: "An ergonomic chair. Your back says thanks." },
  s: { name: "sofa", seat: "sofa", text: "A comfy sofa. Perfect for a quick nap." },
  t: { name: "tv", text: "It's a show about context windows. Season 7." },
  k: { name: "shelf", text: "Books about prompting, caching and cold starts." },
  p: { name: "plant", text: "A healthy plant. Someone remembers to water it." },
  o: { name: "coffee", text: "The coffee machine is still warm." },
  I: { name: "inn door", portal: true },
  x: { name: "exit", portal: true },
  "1": PLOT,
  "2": PLOT,
  "3": PLOT,
  "4": PLOT,
  "5": PLOT,
  "6": PLOT,
  "7": PLOT,
  "8": PLOT,
};

export class GameMap {
  readonly width: number;
  readonly height: number;

  constructor(
    readonly id: MapId,
    readonly name: string,
    readonly rows: readonly string[],
  ) {
    this.width = rows[0]!.length;
    this.height = rows.length;
  }

  /** Tile character; outside the map reads as a wall. */
  at(x: number, y: number): string {
    return this.rows[y]?.[x] ?? "W";
  }

  kind(x: number, y: number): TileKind {
    return LEGEND[this.at(x, y)] ?? LEGEND.W!;
  }

  walkable(x: number, y: number): boolean {
    return this.kind(x, y).walk === true;
  }

  /** Every tile with character `ch`, in reading order. */
  find(ch: string): [number, number][] {
    const out: [number, number][] = [];
    this.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x, y]);
    });
    return out;
  }
}

export const MAPS: Record<MapId, GameMap> = {
  town: new GameMap("town", "Town square", [
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "TT..T..T..T..T..T..T..T..T..T..T..T..T..T..T..TT",
    "T......................,,........T.............T",
    "T.............T.....T..,,...T..................T",
    "T.HHHHHHH.HHHHHHH......,,......HHHHHHH.HHHHHHH.T",
    "T.HHHHHHH.HHHHHHH......,,......HHHHHHH.HHHHHHH.T",
    'T.HHHHHHH.HHHHHHH..."..,,..."..HHHHHHH.HHHHHHH.T',
    'T.HHHHHHH.HHHHHHH....".,,.."...HHHHHHH.HHHHHHH.T',
    "T.HHH1HHH.HHH2HHH......,,......HHH3HHH.HHH4HHH.T",
    "T...,,,.....,,,........,,........,,,.....,,,...T",
    "T....,.......,.........,,.........,.......,....T",
    "T....,.......,....L::::::::::L....,.......,....T",
    'T....,.."...",..^.::N::FF:::::.^..,.....".,."..T',
    'T...",..."...,....:B:::FF::B::....,......",....T',
    "T....,.......,....::::::::::::....,.......,....T",
    "T,,,,,,,,,,,,,,,,,::::::::::::,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,::::::::::::,,,,,,,,,,,,,,,,,T",
    "T.......T.........::::::::::::..........T......T",
    "T.HHHHHHH.HHHHHHH.:B::::::::B:.HHHHHHH.HHHHHHH.T",
    "T.HHHHHHH.HHHHHHH.::::::::::::.HHHHHHH.HHHHHHH.T",
    "T.HHHHHHH.HHHHHHH.L::::::::::L.HHHHHHH.HHHHHHHTT",
    "T.HHHHHHH.HHHHHHH......,,......HHHHHHH.HHHHHHH.T",
    "T.HHH5HHH.HHH6HHH......,,......HHH7HHH.HHH8HHH.T",
    "T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T",
    "T......................,,......................T",
    "T...........T..~~~~....,,.HHHHHHH............^.T",
    'T.^......^....~~~~~~...,,.HHHHHHH.""...........T',
    'T.....".....".~~~~~~.".,,.HHHHHHH.......^..."..T',
    'T......"......~~~~~~...,,.HHHIHHH.."".T......".T',
    "T.T.......T............,,,,,,,..............T..T",
    "T..............................................T",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ]),
  hq: new GameMap("hq", "Company house", [
    "WWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWW",
    "Wkk_b_b_b_b_p__dddd_oW",
    "W______________cccc__W",
    "W____________________W",
    "W___b_b_b_b__________W",
    "W______________dddd__W",
    "W______________cccc__W",
    "W____________________W",
    "W__==tt==____________W",
    "W__======____________W",
    "W__=ssss=____________W",
    "Wp__________________pW",
    "WWWWWWWWWWWxWWWWWWWWWW",
  ]),
  inn: new GameMap("inn", "The Inn", [
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "W_b_b_b_b__okkpW",
    "W______________W",
    "W______________W",
    "W_b_b_b_b_dddd_W",
    "W_________cccc_W",
    "W______________W",
    "Wp____________pW",
    "WWWWWWWxWWWWWWWW",
  ]),
};

/** Where you arrive in town: the middle of the square. */
export const TOWN_SPAWN: [number, number] = [23, 17];

export const PLOT_COUNT = 8;
/** Each company plot is 7×5 tiles with its door in the middle of the bottom row. */
export const PLOT_W = 7;
export const PLOT_H = 5;
