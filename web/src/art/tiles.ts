import type { GameMap } from "@tokenmaxxing/core/maps.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { typedSwitch, typedSwitchGroup } from "hanzio";
import { stairs } from "./basement.ts";
import { C } from "./palette.ts";
import { bake, hash, Pen } from "./pixels.ts";

/** What a tile's ground is made of. Objects stand on whatever their neighbours are. */
type Ground =
  | "grass"
  | "path"
  | "plaza"
  | "flowers"
  | "water"
  | "floor"
  | "rug"
  | "wall"
  | "exit"
  | "stairs"
  | "stairsUp"
  | "stone"
  | "dais"
  | "stage";

const GROUND: Record<string, Ground> = {
  ".": "grass",
  ",": "path",
  ":": "plaza",
  '"': "flowers",
  "~": "water",
  _: "floor",
  "=": "rug",
  W: "wall",
  x: "exit",
  S: "stairs",
  u: "stairsUp",
  R: "exit",
  q: "stone",
  Z: "dais",
  e: "stage",
};

/** The dungeon's stone: darker than the square's, and lit by its torches. */
const DUNGEON = {
  floor: "#2f2b3a",
  floorDark: "#24212d",
  floorLight: "#3b3647",
  dais: "#4a4459",
  daisDark: "#2a2633",
  daisLight: "#5d5670",
  rune: "#b98cff",
  wall: "#3a3446",
  wallDark: "#2a2533",
  wallTop: "#1c1924",
  wallTopLight: "#2a2533",
};

function groundAt(map: GameMap, x: number, y: number): Ground {
  const own = GROUND[map.at(x, y)];
  if (own) return own;
  // Furniture and scenery: take the most common walkable ground around it.
  const counts = new Map<Ground, number>();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
  ] as const) {
    const g = GROUND[map.at(x + dx, y + dy)];
    if (g && g !== "wall" && g !== "water" && g !== "exit" && g !== "stairs" && g !== "stairsUp")
      counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (best) return best;
  return typedSwitch(map.id, {
    town: () => "grass",
    dungeon: () => "stone",
    ...typedSwitchGroup(map.id, ["hq", "inn", "upstairs", "basement", "office"], (): Ground => "floor"),
  });
}

function grass(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.grass);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const h = hash(x * TILE + i, y * TILE + j, 1);
      if (h < 0.035) {
        p.px(ox + i, oy + j, C.grassDark);
        if (j > 0) p.px(ox + i, oy + j - 1, C.grassDark);
      } else if (h < 0.06) p.px(ox + i, oy + j, C.grassLight);
    }
}

function flowers(p: Pen, ox: number, oy: number, x: number, y: number): void {
  grass(p, ox, oy, x, y);
  const colors = [C.flowerRed, C.flowerYellow, C.flowerWhite];
  for (let k = 0; k < 4; k++) {
    const fx = 2 + Math.floor(hash(x, y, 10 + k) * 11);
    const fy = 2 + Math.floor(hash(x, y, 20 + k) * 11);
    const c = colors[Math.floor(hash(x, y, 30 + k) * 3)]!;
    p.rect(ox + fx - 1, oy + fy, 3, 1, c);
    p.rect(ox + fx, oy + fy - 1, 1, 3, c);
    p.px(ox + fx, oy + fy, C.flowerYellow === c ? C.flowerRed : C.flowerYellow);
    p.px(ox + fx, oy + fy + 2, C.leafDark);
  }
}

function speckle(
  p: Pen,
  ox: number,
  oy: number,
  x: number,
  y: number,
  base: string,
  dark: string,
  light: string,
) {
  p.rect(ox, oy, TILE, TILE, base);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const h = hash(x * TILE + i, y * TILE + j, 2);
      if (h < 0.05) p.px(ox + i, oy + j, dark);
      else if (h < 0.09) p.px(ox + i, oy + j, light);
    }
}

function plaza(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.plaza);
  for (let j = 0; j < TILE; j++) {
    const gy = y * TILE + j;
    const offset = Math.floor(gy / 8) % 2 === 0 ? 0 : 4;
    for (let i = 0; i < TILE; i++) {
      const gx = x * TILE + i;
      if (gy % 8 === 0 || (gx + offset) % 8 === 0) p.px(ox + i, oy + j, C.plazaDark);
      else if (gy % 8 === 1 || (gx + offset) % 8 === 1) p.px(ox + i, oy + j, C.plazaLight);
    }
  }
}

function water(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.water);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++)
      if (hash(x * TILE + i, y * TILE + j, 3) < 0.04) p.px(ox + i, oy + j, C.waterDark);
  // Shore: foam and a dark lip wherever the water meets land.
  const land = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "~";
  if (land(0, -1)) {
    p.rect(ox, oy, TILE, 2, C.foam);
    p.rect(ox, oy + 2, TILE, 1, C.waterLight);
  }
  if (land(0, 1)) p.rect(ox, oy + TILE - 2, TILE, 2, C.waterDark);
  if (land(-1, 0)) p.rect(ox, oy, 2, TILE, C.foam);
  if (land(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, C.foam);
}

function floor(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.floor);
  for (let j = 0; j < TILE; j += 4) {
    p.rect(ox, oy + j + 3, TILE, 1, C.floorLine);
    const joint = Math.floor(hash(x, y * 4 + j, 4) * TILE);
    p.rect(ox + joint, oy + j, 1, 3, C.floorDark);
  }
}

/** Flagstones, offset every other row like the plaza but rougher. */
function stone(p: Pen, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, DUNGEON.floor);
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const gx = x * TILE + i;
      const gy = y * TILE + j;
      const offset = Math.floor(gy / 8) % 2 === 0 ? 0 : 4;
      if (gy % 8 === 0 || (gx + offset) % 8 === 0) p.px(ox + i, oy + j, DUNGEON.floorDark);
      else if (hash(gx, gy, 6) < 0.05) p.px(ox + i, oy + j, DUNGEON.floorLight);
    }
}

/** The boss's dais: raised, with a lip and a front face, and runes along its edge. */
function dais(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const off = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "Z";
  p.rect(ox, oy, TILE, TILE, DUNGEON.dais);
  if (off(0, -1)) p.rect(ox, oy, TILE, 2, DUNGEON.daisLight);
  if (off(-1, 0)) p.rect(ox, oy, 2, TILE, DUNGEON.daisLight);
  if (off(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, DUNGEON.daisDark);
  if (off(0, 1)) {
    p.rect(ox, oy + TILE - 5, TILE, 5, DUNGEON.daisDark);
    p.rect(ox + 3, oy + TILE - 3, 2, 1, DUNGEON.rune);
    p.rect(ox + 10, oy + TILE - 3, 2, 1, DUNGEON.rune);
  }
}

function rug(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  p.rect(ox, oy, TILE, TILE, C.rug);
  const edge = (dx: number, dy: number) =>
    map.at(x + dx, y + dy) !== "=" && map.at(x + dx, y + dy) !== "t" && map.at(x + dx, y + dy) !== "s";
  if (edge(0, -1)) p.rect(ox, oy, TILE, 2, C.rugDark);
  if (edge(0, 1)) p.rect(ox, oy + TILE - 2, TILE, 2, C.rugDark);
  if (edge(-1, 0)) p.rect(ox, oy, 2, TILE, C.rugDark);
  if (edge(1, 0)) p.rect(ox + TILE - 2, oy, 2, TILE, C.rugDark);
  if ((x + y) % 2 === 0) {
    p.rect(ox + 7, oy + 4, 2, 8, C.rugLight);
    p.rect(ox + 4, oy + 7, 8, 2, C.rugLight);
  }
}

/** The Tavern's stage: raised boards, darker than the floor, with a lit lip along its front. */
function stage(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const off = (dx: number, dy: number) => map.at(x + dx, y + dy) !== "e";
  p.rect(ox, oy, TILE, TILE, C.woodDark);
  for (let i = 0; i < TILE; i += 4) p.rect(ox + i + 3, oy, 1, TILE, C.trunkDark);
  for (let j = 0; j < TILE; j += 8) p.px(ox + ((x * 5 + j) % 14), oy + j + 2, C.wood);
  if (off(0, -1)) p.rect(ox, oy, TILE, 1, C.wood);
  if (off(0, 1)) {
    p.rect(ox, oy + TILE - 3, TILE, 3, C.trunkDark);
    p.rect(ox, oy + TILE - 3, TILE, 1, C.woodLight);
  }
  if (off(-1, 0)) p.rect(ox, oy, 1, TILE, C.trunkDark);
  if (off(1, 0)) p.rect(ox + TILE - 1, oy, 1, TILE, C.trunkDark);
}

function wall(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  const dark = map.id === "dungeon";
  const top = dark ? DUNGEON.wallTop : C.wallTop;
  const topLight = dark ? DUNGEON.wallTopLight : C.wallTopLight;
  // The office door is in the wall's face, so the wall above it stays a wall top.
  const face = !"WR".includes(map.at(x, y + 1)) && map.contains(x, y + 1);
  if (!face) {
    p.rect(ox, oy, TILE, TILE, top);
    if (hash(x, y, 5) < 0.3) p.rect(ox + 3, oy + 6, 6, 1, topLight);
    return;
  }
  if (dark) {
    // Stone blocks.
    p.rect(ox, oy, TILE, TILE, DUNGEON.wall);
    for (let j = 0; j < TILE; j += 5) {
      p.rect(ox, oy + j, TILE, 1, DUNGEON.wallDark);
      p.rect(ox + ((x * 7 + j) % 8) + (j % 10 === 0 ? 0 : 4), oy + j, 1, 5, DUNGEON.wallDark);
    }
    p.rect(ox, oy, TILE, 2, topLight);
    return;
  }
  p.rect(ox, oy, TILE, TILE, C.wall);
  for (let i = 0; i < TILE; i += 4) p.rect(ox + i, oy + 2, 1, TILE - 5, C.wallDark);
  p.rect(ox, oy, TILE, 2, C.wallTopLight);
  p.rect(ox, oy + TILE - 3, TILE, 3, C.woodDark);
}

function exit(p: Pen, map: GameMap, ox: number, oy: number, x: number, y: number): void {
  // The basement's way out is the stairs up, not a doormat; upstairs it is the stairs down.
  if (map.id === "basement" || map.id === "upstairs") {
    stairTile(p, ox, oy, x, y, map.id === "upstairs");
    return;
  }
  if (map.id === "dungeon") stone(p, ox, oy, x, y);
  else floor(p, ox, oy, x, y);
  p.rect(ox, oy, 2, TILE, C.woodDark);
  p.rect(ox + TILE - 2, oy, 2, TILE, C.woodDark);
  p.rect(ox + 3, oy + 4, TILE - 6, 8, C.rugLight);
  p.rect(ox + 4, oy + 5, TILE - 8, 6, C.rug);
}

/** Stairs (`S` down and `u` up in the Tavern, the basement's `x` up and upstairs' down): floor under the steps' landing. */
function stairTile(p: Pen, ox: number, oy: number, x: number, y: number, down: boolean): void {
  floor(p, ox, oy, x, y);
  p.g.drawImage(stairs(down), ox, oy);
}

/** One tile's ground, in its place on a canvas of the whole map. */
function paintTile(p: Pen, map: GameMap, x: number, y: number): void {
  const ox = (x - map.x0) * TILE;
  const oy = (y - map.y0) * TILE;
  typedSwitch(groundAt(map, x, y), {
    grass: () => grass(p, ox, oy, x, y),
    flowers: () => flowers(p, ox, oy, x, y),
    path: () => speckle(p, ox, oy, x, y, C.path, C.pathDark, C.pathLight),
    plaza: () => plaza(p, ox, oy, x, y),
    water: () => water(p, map, ox, oy, x, y),
    floor: () => floor(p, ox, oy, x, y),
    rug: () => rug(p, map, ox, oy, x, y),
    wall: () => wall(p, map, ox, oy, x, y),
    exit: () => exit(p, map, ox, oy, x, y),
    stone: () => stone(p, ox, oy, x, y),
    stairs: () => stairTile(p, ox, oy, x, y, true),
    stairsUp: () => stairTile(p, ox, oy, x, y, false),
    dais: () => dais(p, map, ox, oy, x, y),
    stage: () => stage(p, map, ox, oy, x, y),
  });
}

/** The whole map's ground as one canvas; scenery and people are drawn over it every frame. */
export function bakeGround(map: GameMap): HTMLCanvasElement {
  return bake(map.width * TILE, map.height * TILE, (p) => {
    for (let y = map.y0; y < map.y0 + map.height; y++)
      for (let x = map.x0; x < map.x0 + map.width; x++) paintTile(p, map, x, y);
  });
}

/** Paints just these tiles again, on a ground baked for the same map before a drop came or went. */
export function repaintGround(canvas: HTMLCanvasElement, map: GameMap, tiles: [number, number][]): void {
  const p = new Pen(canvas.getContext("2d")!);
  for (const [x, y] of tiles) {
    if (!map.contains(x, y)) continue;
    p.g.clearRect((x - map.x0) * TILE, (y - map.y0) * TILE, TILE, TILE);
    paintTile(p, map, x, y);
  }
}

/** Moving glints on water, drawn per frame on top of the baked ground. */
export function drawWaterGlints(g: CanvasRenderingContext2D, map: GameMap, t: number): void {
  g.fillStyle = C.waterLight;
  const phase = Math.floor(t / 600);
  for (const [x, y] of map.find("~")) {
    if (hash(x, y, phase % 7) > 0.5) continue;
    const i = 2 + Math.floor(hash(x, y, phase) * 9);
    const j = 4 + Math.floor(hash(y, x, phase) * 8);
    g.fillRect(x * TILE + i, y * TILE + j, 3, 1);
  }
}
