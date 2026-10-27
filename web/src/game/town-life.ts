import { PLAZA } from "@tokenmaxxing/core/maps.ts";
import { dayKey } from "@tokenmaxxing/core/range.ts";
import { TILE } from "@tokenmaxxing/core/world.ts";
import { hud } from "../store.ts";
import type { Frame } from "./frame.ts";
import { skyNow } from "./sky.ts";
import { self, world } from "./world.ts";

let animalCache: {
  map: typeof world.map;
  day: string;
  cat: [number, number];
  birds: [number, number][];
} | null = null;
/** The cat changes sleeping spots daily. Birds share fixed landmarks, but react locally to passers-by. */
export function townAnimals(): { cat: [number, number]; birds: [number, number][] } | null {
  if (world.room !== "town") return null;
  const day = dayKey(skyNow());
  if (animalCache?.map === world.map && animalCache.day === day) return animalCache;
  const tiles = world.map
    .find(":")
    .filter(([x, y]) => x > PLAZA.left && x < PLAZA.right && y > PLAZA.top && y < PLAZA.bottom);
  if (tiles.length < 9) return null;
  const seed = [...day].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  animalCache = {
    map: world.map,
    day,
    cat: tiles[seed % tiles.length]!,
    birds: [tiles[2]!, tiles[5]!, tiles[8]!],
  };
  return animalCache;
}

let petUntil = 0;
const scaredUntil = [0, 0, 0];
export function animalAt(x: number, y: number): "cat" | "bird" | null {
  const animals = townAnimals();
  if (!animals) return null;
  if (animals.cat[0] === x && animals.cat[1] === y) return "cat";
  return animals.birds.some(([bx, by]) => bx === x && by === y) ? "bird" : null;
}
export function interactAnimal(x: number, y: number): boolean {
  const animal = animalAt(x, y);
  if (!animal) return false;
  if (animal === "cat") {
    petUntil = performance.now() + 2500;
    hud.set({ dialog: "The town cat purrs and leans into your hand. 🐈" });
  } else {
    const animals = townAnimals()!;
    const index = animals.birds.findIndex(([bx, by]) => bx === x && by === y);
    if (index >= 0) scaredUntil[index] = performance.now() + 2000;
  }
  return true;
}
export function animalMotion(index: number, x: number, y: number, now: number): number {
  const me = self();
  if (me && Math.hypot(me.x - x, me.y - y) < 1.3) scaredUntil[index] = now + 1400;
  return Math.max(0, Math.min(1, ((scaredUntil[index] ?? 0) - now) / 500));
}
export const catPetted = (now: number): boolean => now < petUntil;

let lastProp = "";
let taps = 0;
export function interactTownProp(x: number, y: number): boolean {
  if (world.room !== "town") return false;
  const ch = world.map.at(x, y);
  if (ch !== "T" && ch !== "^" && ch !== "L") return false;
  const key = `${x},${y}`;
  taps = key === lastProp ? taps + 1 : 1;
  lastProp = key;
  const text =
    ch === "T"
      ? taps >= 3
        ? "A tiny door in the trunk opens. A note reads: you found the tree's secret. 🌳"
        : "The tree rustles. Something seems to be tucked inside."
      : ch === "^"
        ? taps >= 3
          ? "A tiny paper crown lies inside the bush. You leave it for its owner. 👑"
          : "The bush rustles suspiciously."
        : "The lamp gives a cheerful little hum. ✨";
  hud.set({ dialog: text });
  return true;
}

export function drawTownAnimals({ g, items, now }: Frame): void {
  const animals = townAnimals();
  if (!animals) return;
  const [cx, cy] = animals.cat;
  items.push({
    y: (cy + 1) * TILE - 1,
    draw: () => {
      const x = cx * TILE,
        y = cy * TILE;
      g.fillStyle = "#5b3d2b";
      g.fillRect(x + 3, y + 9, 10, 5);
      g.fillRect(x + 4, y + 6, 6, 5);
      g.fillRect(x + 4, y + 4, 2, 3);
      g.fillRect(x + 8, y + 4, 2, 3);
      g.fillRect(x + 12, y + 10, 3, 2);
      g.fillStyle = "#f3d197";
      g.fillRect(x + 6, y + 9, 2, 1);
      if (catPetted(now)) {
        g.fillStyle = "#f482a1";
        g.fillRect(x + 10, y + 1, 3, 3);
      }
    },
  });
  animals.birds.forEach(([bx, by], i) => {
    const flying = animalMotion(i, bx, by, now);
    items.push({
      y: (by + 1) * TILE,
      draw: () => {
        const x = bx * TILE + 5 + flying * (i % 2 ? 8 : -8),
          y = by * TILE + 10 - flying * 12;
        g.fillStyle = "#6c7880";
        g.fillRect(x, y, 7, 4);
        g.fillStyle = "#aeb8bd";
        g.fillRect(x + 2, y - 2, 4, 4);
        g.fillStyle = "#e8b65b";
        g.fillRect(x + 6, y, 2, 1);
      },
    });
  });
}
