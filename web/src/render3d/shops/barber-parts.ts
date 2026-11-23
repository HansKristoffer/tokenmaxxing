/**
 * The barber shop's pieces: voxel heads on stands, price cards, shelves, the classic barber chair, the pole,
 * mirror stations, sinks and the people (shopkeeper, apprentice and the customers under their capes).
 * Everything faces +z with its origin on the floor at the middle of its footprint; `barber.ts` places them.
 */
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { light } from "../furniture/furniture.ts";
import { canvasTexture, glass, glow, Model, painted, seeded, ticks, tint } from "../kit/kit.ts";
import { Avatar, type Look, personLook } from "../people/avatar.ts";
import { type Look2D, lookFrom2D } from "../people/gear3d.ts";
import type { BarberRow } from "./data/barber.ts";

export const RED = "#c4352f";
export const BLUE = "#2e5fa8";
export const CREAM = "#f4efe4";
export const CHROME = "#cfd6de";
export const CHROME_DARK = "#8a93a1";
export const LEATHER = "#8e2a2a";
export const TEAL = "#6fb5a8";
const FONT = "ui-monospace, Menlo, Consolas, monospace";
const RARITY: Record<string, string> = {
  common: "#9aa3ad",
  uncommon: "#5fb85f",
  rare: "#4f8fe0",
  epic: "#9b6fd6",
  legendary: "#f0b53c",
};

/**
 * Just the head of a 2D look, in cubes. `voxelStyle` overrides the hair the mapper picks, for the one 2D
 * style (the bun) that `lookFrom2D` draws as something else.
 */
export function bareHead(look: Look2D, voxelStyle?: number): { head: Model; avatar: Avatar } {
  const voxelLook = lookFrom2D(look);
  if (voxelStyle !== undefined) voxelLook.style = voxelStyle;

  const avatar = new Avatar(voxelLook);
  const head = avatar.head;
  head.removeFromParent();
  head.position.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  return { head, avatar };
}

/** Keeps `fn` ticking while `obj` is in a scene; removes itself once the shop or preview is disposed. */
function alive(obj: Model, fn: (dt: number, t: number) => void): void {
  let seen = false;
  let waited = 0;
  let last = 0;
  const tick = (t: number) => {
    let top: Model["parent"] = obj;
    while (top?.parent) top = top.parent;
    const inScene = !!top && (top as { isScene?: boolean }).isScene === true;
    if (inScene) {
      seen = true;
      const dt = last ? Math.min(0.1, Math.max(0, t - last)) : 0;
      last = t;
      fn(dt, t);
      return;
    }

    // Gives up on an object that never reaches the scene: 900 ticks of waiting, then it is dropped.
    if (seen || ++waited > 900) {
      const at = ticks.indexOf(tick);
      if (at >= 0) ticks.splice(at, 1);
    }
  };
  ticks.push(tick);
}

/** A head on a little wooden stand, like a wig or a window dummy. `scale` grows the head, not the stand. */
export function headOnStand(
  look: Look2D,
  opts: { voxelStyle?: number; scale?: number; live?: boolean } = {},
): Model {
  const m = new Model();
  const { head, avatar } = bareHead(look, opts.voxelStyle);
  const scale = opts.scale ?? 1.1;

  m.cyl(0.13, 0.025, C.woodDark, [0, 0, 0], 0.12, 12);
  m.cyl(0.04, 0.12, "#d9d2c5", [0, 0.02, 0], 0.05, 8);
  head.scale.setScalar(scale);
  head.position.y = 0.13;
  m.add(head);

  // Only heads with animated face gear (e.g. laser eyes) need ticking; static display heads bake into the room.
  if (opts.live && avatar.look.gear?.animated) {
    head.userData.live = true;
    alive(head, (dt, t) => avatar.update(dt, t));
  } else {
    head.traverse((node) => {
      delete node.userData.rigid;
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material) && mesh.material.userData.dynamic) {
        delete mesh.material.userData.dynamic;
      }
    });
  }
  return m;
}

/** A look from the picker's three numbers (and a face thing). The outfit is the cap's colour on style 1. */
export const lookOf = (style: number, hair: number, skin: number, glasses = 0, outfit = 1): Look2D => ({
  style,
  hair,
  skin,
  outfit,
  glasses,
});

/** The 2D hairstyles in cubes: Short, Cap, Bun (the mapper's spiky is not what the name says), Long. */
export const wig = (style: number, hair: number, skin = 1): Model =>
  headOnStand(lookOf(style, hair, skin, 0, (hair + 1) % 8), { voxelStyle: style === 2 ? 3 : undefined });

const coin = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.fillStyle = "#8a5f14";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f5c842";
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.fill();
};

/** Words wrapped to `max` characters a line. */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * A slim price card: the name (wrapped) and the price (a coin and the number, or `Free`) on cream, under a
 * stripe in the rarity's colour. `h` is the card; it has only a thin frame, so it hides little behind it.
 */
export function priceCard(
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  w = 0.86,
  h = 0.34,
  label?: string,
  font = 9,
): Model {
  const px = 100;
  const rowH = font + 1;
  const m = new Model();
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);

  const tex = canvasTexture(cw, ch, (ctx) => {
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = RARITY[row.rarity ?? "common"]!;
    ctx.fillRect(0, 0, cw, 3);

    ctx.fillStyle = "#2b2433";
    ctx.font = `bold ${font}px ${FONT}`;
    ctx.textBaseline = "top";
    const price = row.level ? `Lv ${row.level}` : row.price ? String(row.price) : "Free";
    const coined = !!row.price && !row.level;
    const priceW = ctx.measureText(price).width + (coined ? 10 : 0);

    // Rows that fit under the stripe, and whether the price can sit on the last name row.
    const lines = wrap(label ?? row.name, Math.floor((cw - 4) / (font * 0.6)));
    const maxRows = Math.max(1, Math.floor((ch - 5) / rowH));
    let shown = lines.slice(0, maxRows);
    const fits = (line: string) => ctx.measureText(line).width + priceW + 8 < cw;
    let inline = fits(shown[shown.length - 1]!);
    if (!inline && shown.length === maxRows) {
      shown = lines.slice(0, Math.max(1, maxRows - 1));
      inline = shown.length === 1 && maxRows === 1 && fits(shown[0]!);
    }

    ctx.textAlign = "left";
    for (const [index, line] of shown.entries()) ctx.fillText(line, 4, 5 + index * rowH);

    const y = 5 + (inline ? shown.length - 1 : shown.length) * rowH;
    ctx.textAlign = "right";
    ctx.fillStyle = row.level ? "#9b6fd6" : coined ? "#8a5f14" : "#3f8c50";
    ctx.fillText(price, cw - 4, y);
    if (coined) coin(ctx, cw - 4 - (priceW - 10) - 5, y + 4, 4);
  });

  m.box([w + 0.03, h + 0.03, 0.02], "#5b3a24", [0, 0, 0], 0.004);
  m.plane(w, h, painted(tex), [0, (h + 0.03) / 2, 0.011]);
  return m;
}

/** A card lying back on a ledge, so it can be read from above without hiding what stands behind it. */
export function leanCard(
  m: Model,
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  at: [number, number, number],
  w?: number,
  h?: number,
  label?: string,
): void {
  const card = priceCard(row, w, h, label);
  card.position.set(...at);
  card.rotation.x = -1.2;
  m.add(card);
}

/** A card hung on the front lip of a shelf, upright, so nothing stands in front of it. */
export function lipCard(
  m: Model,
  row: Pick<BarberRow, "name" | "price" | "level" | "rarity">,
  at: [number, number, number],
  w = 0.9,
  h = 0.3,
): void {
  const card = priceCard(row, w, h, undefined, 8);
  card.position.set(...at);
  m.add(card);
}

/** A wall unit: back board, sides, `tiers` boards at the given heights and a cabinet underneath. */
export function shelfUnit(
  w: number,
  depth: number,
  tierY: number[],
  opts: { cabinet?: number; wood?: string; top?: number; back?: string } = {},
): Model {
  const m = new Model();
  const wood = opts.wood ?? C.woodLight;
  const dark = tint(wood, -0.25);
  const top = opts.top ?? tierY[tierY.length - 1]! + 0.62;
  const cabinetH = opts.cabinet ?? 0.45;

  m.box([w - 0.02, top, 0.06], opts.back ?? tint(wood, 0.1), [0, 0, -depth / 2 + 0.026], 0.01);
  for (const side of [-1, 1]) m.box([0.06, top, depth], dark, [side * (w / 2 - 0.03), 0, 0], 0.01);
  for (const y of tierY) m.box([w - 0.08, 0.05, depth - 0.02], wood, [0, y - 0.05, 0], 0.01);
  m.box([w, 0.04, depth + 0.02], dark, [0, top, 0], 0.01);

  if (cabinetH > 0) {
    m.box([w - 0.02, cabinetH, depth], tint(wood, -0.1), [0, 0, 0], 0.02);

    // One door and one chrome pull per tile of width.
    const doors = Math.max(1, Math.round(w));
    for (let door = 0; door < doors; door++) {
      const x = -w / 2 + (door + 0.5) * (w / doors);
      m.box([w / doors - 0.1, cabinetH - 0.12, 0.03], wood, [x, 0.06, depth / 2 + 0.01], 0.01);
      m.box([0.12, 0.025, 0.03], CHROME, [x, cabinetH * 0.6, depth / 2 + 0.03], 0.005);
    }
  }
  return m;
}

/** The stripe texture of a barber pole: red, white and blue on the diagonal, wrapping round. */
function poleTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(32, 32, (ctx) => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        // Three bands of the diagonal, 11, 11 and 10 pixels wide: red, white, then blue.
        const along = (x + y) % 32;
        ctx.fillStyle = [RED, "#fbf7ef", BLUE][Math.floor(along / 11)]!;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** A barber pole in a glass tube with chrome caps; the stripes climb. */
export function barberPole(h: number, r: number, lit = false): Model {
  const m = new Model();
  const tex = poleTexture();
  tex.repeat.set(1, Math.max(1, Math.round(h / (r * 3.2))));

  const body = m.cyl(r, h, lit ? glow("#fff", tex) : painted(tex), [0, 0.03 * h, 0], r, 20);
  body.castShadow = true;
  m.cyl(r * 1.25, h * 0.04, CHROME, [0, 0, 0], r * 1.2, 16);
  m.cyl(r * 1.25, h * 0.05, CHROME, [0, h * 0.95, 0], r * 1.2, 16);
  m.ball(r * 1.15, CHROME, [0, h * 1.0 + r * 0.2, 0], [1, 0.85, 1], 14);

  // The stripes climb faster on a taller pole.
  const speed = 0.35 + h * 0.1;
  ticks.push((time) => {
    tex.offset.y = -((time * speed) % 1);
  });
  return m;
}

/** The classic barber chair, facing +z: chrome base and pump, red leather seat, arms, headrest, footrest. */
export function barberChair(): Model {
  const m = new Model();
  m.cyl(0.3, 0.05, "#2a2a32", [0, 0, 0], 0.28, 18);
  m.cyl(0.32, 0.03, CHROME, [0, 0.04, 0], 0.3, 18);
  m.cyl(0.09, 0.3, CHROME, [0, 0.07, 0], 0.075, 12);
  m.cyl(0.11, 0.04, CHROME_DARK, [0, 0.34, 0], 0.11, 12);

  m.box([0.62, 0.14, 0.58], LEATHER, [0, 0.38, 0], 0.06);
  m.box([0.6, 0.08, 0.1], tint(LEATHER, 0.1), [0, 0.5, 0.24], 0.04);
  const back = m.box([0.6, 0.66, 0.14], LEATHER, [0, 0.46, -0.3], 0.06);
  back.rotation.x = -0.14;

  const headrest = m.box([0.34, 0.2, 0.1], tint(LEATHER, 0.08), [0, 1.04, -0.37], 0.05);
  headrest.rotation.x = -0.14;
  m.cyl(0.02, 0.1, CHROME, [0, 0.98, -0.37], 0.02, 6);

  for (const side of [-1, 1]) {
    m.box([0.1, 0.07, 0.5], tint(LEATHER, -0.12), [side * 0.36, 0.64, -0.02], 0.03);
    m.box([0.05, 0.28, 0.05], CHROME, [side * 0.36, 0.38, 0.12], 0.01);
    m.box([0.05, 0.28, 0.05], CHROME, [side * 0.36, 0.38, -0.22], 0.01);
    const footRest = m.cyl(0.015, 0.34, CHROME, [side * 0.14, 0.1, 0.5], 0.015, 6);
    footRest.rotation.x = -0.5;
  }
  m.box([0.5, 0.05, 0.22], CHROME_DARK, [0, 0.07, 0.52], 0.02);
  m.box([0.44, 0.02, 0.18], "#2a2a32", [0, 0.12, 0.52], 0.008);
  return m;
}

/** A mirror: a pale pane with a streak of shine, in a frame, ringed with bulbs. `w`×`h`, bottom centre. */
export function mirror(w: number, h: number, bulbs = true): Model {
  const m = new Model();
  const tex = canvasTexture(24, 32, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 24, 32);
    grad.addColorStop(0, "#e6f3fb");
    grad.addColorStop(1, "#a9cde0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 32);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (const [x, width] of [
      [6, 3],
      [12, 1],
    ] as const) {
      for (let y = 0; y < 32; y++) ctx.fillRect(x + Math.floor(y * 0.5), y, width, 1);
    }
  });

  m.box([w + 0.14, h + 0.14, 0.06], "#5b3a24", [0, 0, 0], 0.02);
  m.box([w + 0.04, h + 0.04, 0.03], CHROME, [0, 0.05, 0.03], 0.01);
  m.plane(w, h, glow("#fff", tex), [0, 0.07 + h / 2, 0.052]);

  if (bulbs) {
    // A bulb every 0.28 world units along the top and bottom edges, and four down each side.
    const gaps = Math.round(w / 0.28);
    const bulb = (x: number, y: number) => {
      m.ball(0.035, glow("#fff1b8"), [x, y, 0.07], [1, 1, 0.8], 6);
    };
    for (let step = 0; step <= gaps; step++) {
      bulb(-w / 2 + (step * w) / gaps, h + 0.11);
      bulb(-w / 2 + (step * w) / gaps, -0.03);
    }
    for (let step = 1; step < 4; step++) {
      bulb(-w / 2 - 0.05, (step * h) / 4);
      bulb(w / 2 + 0.05, (step * h) / 4);
    }
  }
  return m;
}

/** A jar of blue disinfectant with combs standing in it (the barbicide). */
function combJar(m: Model, at: [number, number, number]): void {
  m.cyl(0.07, 0.2, glass("#7ec8ee", 0.7), at, 0.07, 12);
  for (const comb of [-1, 0, 1]) {
    m.box(
      [0.012, 0.22, 0.05],
      comb % 2 ? "#2b2433" : "#e25d5d",
      [at[0] + comb * 0.03, at[1] + 0.02, at[2]],
      0.003,
    );
  }
  m.cyl(0.075, 0.025, "#2e5fa8", [at[0], at[1] + 0.2, at[2]], 0.075, 12);
}

function scissors(m: Model, at: [number, number, number], rot = 0): void {
  const pair = m.part(at);
  pair.rotation.y = rot;

  const bladeA = pair.box([0.2, 0.012, 0.02], CHROME, [0, 0, 0], 0.003);
  bladeA.rotation.y = 0.14;
  const bladeB = pair.box([0.2, 0.012, 0.02], CHROME, [0, 0.002, 0], 0.003);
  bladeB.rotation.y = -0.14;

  for (const z of [-0.025, 0.025]) {
    m.ball(0.02, "#e25d5d", [at[0] - 0.1, at[1] + 0.01, at[2] + z], [1, 0.4, 1], 8);
  }
}

function clippers(m: Model, at: [number, number, number], rot = 0): void {
  const clip = m.part(at, rot);
  clip.box([0.07, 0.05, 0.2], "#2b2433", [0, 0, 0], 0.02);
  clip.box([0.08, 0.015, 0.04], CHROME, [0, 0.02, 0.12], 0.004);
  clip.box([0.02, 0.012, 0.02], "#6ad28a", [0, 0.05, -0.02], 0.004);

  // The cord.
  for (let bead = 0; bead < 5; bead++) {
    clip.ball(0.008, "#2b2433", [Math.sin(bead * 1.2) * 0.05, 0.005, -0.12 - bead * 0.05], [1, 1, 1], 4);
  }
}

/**
 * A mirror station on a wall (`w` wide, 0.4 deep): a counter with its pole, the comb jar, scissors, clippers,
 * a spray bottle and folded towels under a lit mirror. Faces +z, its back at z = -0.5.
 */
export function station(seed: number): Model {
  const m = new Model();
  const w = 1.9;
  m.box([w, 0.8, 0.42], "#f1ede0", [0, 0, -0.29], 0.02);
  m.box([w + 0.06, 0.05, 0.48], CHROME, [0, 0.8, -0.28], 0.015);
  for (const column of [-1, 0, 1]) m.box([0.5, 0.58, 0.03], "#cfd9e0", [column * 0.6, 0.1, -0.075], 0.01);

  const pole = barberPole(0.38, 0.055);
  pole.position.set(-0.7, 0.85, -0.3);
  m.add(pole);
  combJar(m, [-0.38, 0.85, -0.32]);
  scissors(m, [0, 0.862, -0.25], 0.4 + seed * 0.3);
  clippers(m, [0.3, 0.872, -0.25], -0.5);

  // Spray bottle and a folded towel stack.
  m.cyl(0.04, 0.16, glass("#9ed9f0", 0.7), [0.62, 0.85, -0.35], 0.04, 10);
  m.box([0.03, 0.04, 0.04], "#e25d5d", [0.62, 1.0, -0.35], 0.01);
  for (let towel = 0; towel < 3; towel++) {
    m.box([0.26, 0.05, 0.2], towel % 2 ? CREAM : "#e8dcc4", [0.78, 0.85 + towel * 0.05, -0.28], 0.015);
  }

  const mirrorPane = mirror(1.35, 0.95, true);
  mirrorPane.position.set(0, 1.12, -0.46);
  m.add(mirrorPane);
  light(m, [0, 1.8, 0.2], "#ffe3b0", 1.4, 4);
  return m;
}

/** Two shampoo basins in a white cabinet, taps, bottles and a rail of towels (a wall unit, 2 wide). */
export function sinks(): Model {
  const m = new Model();
  m.box([1.9, 0.78, 0.5], "#f1ede0", [0, 0, -0.25], 0.02);
  m.box([1.96, 0.06, 0.54], "#e4e8ec", [0, 0.78, -0.25], 0.02);

  for (const side of [-1, 1]) {
    m.cyl(0.24, 0.07, "#bfc9d2", [side * 0.5, 0.82, -0.22], 0.2, 16);
    m.cyl(0.19, 0.02, "#8fb4c8", [side * 0.5, 0.88, -0.22], 0.19, 16);
    m.cyl(0.02, 0.26, CHROME, [side * 0.5, 0.84, -0.46], 0.02, 8);
    m.box([0.03, 0.03, 0.16], CHROME, [side * 0.5, 1.08, -0.4], 0.008);
    m.cyl(0.05, 0.16, glass(side > 0 ? "#f0a8c8" : "#9ed9f0", 0.8), [side * 0.8, 0.84, -0.46], 0.05, 10);
  }

  m.box([1.9, 0.05, 0.07], CHROME, [0, 1.5, -0.44], 0.01);
  for (const [index, x] of [-0.6, -0.2, 0.25, 0.65].entries()) {
    m.box([0.26, 0.5, 0.05], index % 2 ? CREAM : "#e8dcc4", [x, 1.0, -0.4], 0.02);
  }

  const splashback = m.box([1.9, 0.8, 0.04], "#dfe9ee", [0, 0.9, -0.48], 0.01);
  splashback.scale.y = 0.5;
  return m;
}

/** A warm-towel cabinet: glass door, rolled towels inside, steam rising. */
export function towelWarmer(): Model {
  const m = new Model();
  m.box([0.8, 1.15, 0.5], "#f1ede0", [0, 0, -0.2], 0.03);
  m.box([0.7, 0.8, 0.03], glass("#cfe8f4", 0.5), [0, 0.2, 0.06], 0.01);

  for (const shelfY of [0.3, 0.5, 0.7, 0.9]) {
    m.box([0.62, 0.02, 0.4], CHROME_DARK, [0, shelfY, -0.2], 0.005);
    for (const x of [-0.2, 0, 0.2]) {
      const roll = m.cyl(0.07, 0.14, CREAM, [x, shelfY + 0.02, -0.2], 0.07, 10);
      roll.rotation.x = Math.PI / 2;
    }
  }
  m.box([0.5, 0.12, 0.04], "#2b2433", [0, 1.18, 0], 0.01);
  m.box([0.8, 0.05, 0.56], "#5b3a24", [0, 1.15, -0.2], 0.02);

  // Three steam puffs, each rising on its own part of the cycle.
  const puffs = [0, 1, 2].map(() => m.ball(0.06, "#f1f1f1", [0, 1.25, -0.2], [1, 1, 1], 8));
  ticks.push((t) => {
    puffs.forEach((puff, index) => {
      const rise = (t * 0.35 + index / 3) % 1;
      puff.position.set(Math.sin((t + index) * 2) * 0.1, 1.25 + rise * 0.6, -0.2);
      puff.scale.setScalar(0.5 + rise * 1.4);
      (puff.material as THREE.Material).opacity = 1;
      puff.visible = rise < 0.92;
    });
  });
  return m;
}

/** In-scene text over a head: a name chip or a speech bubble that always faces the camera. */
export function billboardText(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
  px = 64,
): { mesh: THREE.Mesh; redraw: () => void } {
  const cw = Math.round(w * px);
  const ch = Math.round(h * px);
  const tex = canvasTexture(cw, ch, (ctx) => draw(ctx, cw, ch), true);

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const faceCamera = new THREE.Quaternion();
  mesh.onBeforeRender = (_r, _s, camera) => {
    // Face the camera whatever the parent's turn.
    if (mesh.parent) mesh.parent.getWorldQuaternion(faceCamera).invert().multiply(camera.quaternion);
    else faceCamera.copy(camera.quaternion);
    mesh.quaternion.copy(faceCamera);
  };
  mesh.renderOrder = 6;

  return {
    mesh,
    redraw: () => {
      const ctx = (tex.image as HTMLCanvasElement).getContext("2d")!;
      ctx.clearRect(0, 0, cw, ch);
      draw(ctx, cw, ch);
      tex.needsUpdate = true;
    },
  };
}

/** A name chip floating over `a`. */
export function nameChip(a: Avatar, name: string, role: string): void {
  const { mesh } = billboardText(
    (ctx, w, h) => {
      ctx.fillStyle = "rgba(43,36,51,0.82)";
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 8);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.fillStyle = "#fbf7ef";
      ctx.font = `bold ${Math.round(h * 0.4)}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(name, w / 2, h * 0.32);
      ctx.fillStyle = "#f5c842";
      ctx.font = `${Math.round(h * 0.28)}px system-ui, sans-serif`;
      ctx.fillText(role, w / 2, h * 0.74);
    },
    0.9,
    0.34,
    96,
  );
  mesh.position.set(0, a.height + 0.28, 0);
  a.root.add(mesh);
}

/** A speech bubble over `a` that says the next line each nine-second cycle, for 4.5 seconds of it. */
export function chatter(a: Avatar, lines: string[], lift = 0.62): void {
  let lineIndex = 0;
  const bubble = billboardText(
    (ctx, w, h) => {
      ctx.fillStyle = "#fbf7ef";
      ctx.strokeStyle = "#2b2433";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(2, 2, w - 4, h - 14, 10);
      ctx.fill();
      ctx.stroke();

      // The tail under the bubble.
      ctx.beginPath();
      ctx.moveTo(w / 2 - 8, h - 13);
      ctx.lineTo(w / 2, h - 2);
      ctx.lineTo(w / 2 + 8, h - 13);
      ctx.fill();

      ctx.fillStyle = "#2b2433";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = lines[lineIndex % lines.length]!.split(" ");
      const rows: string[] = [];
      let current = "";
      for (const word of words) {
        if (current && ctx.measureText(`${current} ${word}`).width > w - 24) {
          rows.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      rows.push(current);
      for (const [rowIndex, text] of rows.entries()) {
        ctx.fillText(text, w / 2, (h - 14) / 2 + (rowIndex - (rows.length - 1) / 2) * 17);
      }
    },
    1.5,
    0.62,
    96,
  );
  bubble.mesh.position.set(0, a.height + lift + 0.3, 0);
  a.root.add(bubble.mesh);

  let shownAt = -100;
  ticks.push((t) => {
    const cycle = t % 9;
    const showing = cycle < 4.5;

    // A new line at most once every eight seconds.
    if (showing && t - shownAt > 8) {
      shownAt = t;
      lineIndex++;
      bubble.redraw();
    }
    bubble.mesh.visible = showing;
    a.talking = showing && cycle < 3.2;
  });
}

/** A plain waistcoat-and-apron over the voxel torso: a bib with stripes, a bow tie, sleeve garters. */
function barberApron(a: Avatar, stripe: boolean): void {
  const body = a.body;
  body.box([0.27, 0.34, 0.025], stripe ? "#fbf7ef" : "#2b2433", [0, 0.42, 0.1], 0.008);
  if (stripe) {
    for (let band = -2; band <= 2; band++) {
      body.box([0.034, 0.332, 0.03], band % 2 ? RED : "#fbf7ef", [band * 0.052, 0.424, 0.1], 0.004);
    }
  }

  body.box([0.04, 0.03, 0.02], "#2b2433", [0, 0.72, 0.1], 0.004);
  body.box([0.05, 0.036, 0.02], RED, [-0.045, 0.72, 0.105], 0.006);
  body.box([0.05, 0.036, 0.02], RED, [0.045, 0.72, 0.105], 0.006);
  for (const side of [-1, 1]) body.box([0.03, 0.2, 0.025], "#2b2433", [side * 0.09, 0.57, 0.1], 0.004);
}

/** The shopkeeper: Figaro, with a waxed moustache, slick hair, a striped apron and scissors in his hand. */
export function makeBarber(): Avatar {
  const look: Look = personLook({
    skin: "#e9b38c",
    hair: "#2e2e3a",
    style: 0,
    outfit: ["#fbf7ef", "#d8d2c4"],
    pants: "#2b2f3a",
    hat: "none",
    beard: 1,
  });
  const avatar = new Avatar(look);
  barberApron(avatar, true);

  // The handlebar curls, a little past the cube moustache.
  const head = avatar.head;
  for (const side of [-1, 1]) {
    const curl = head.box([0.05, 0.016, 0.03], "#2e2e3a", [side * 0.085, 0.092, 0.172], 0.006);
    curl.rotation.z = side * 0.5;
  }

  // The scissors: two blades on a pivot in the hand, each with a red pivot ball.
  const hand = avatar.arms[1];
  const pivot = hand.part([0, -0.3, 0.07]);
  const blade = (side: number) => {
    const bladeModel = pivot.part([0, 0, 0]);
    bladeModel.box([0.012, 0.03, 0.17], CHROME, [0, 0, 0], 0.002);
    bladeModel.rotation.y = side * 0.1;
    bladeModel.ball(0.022, "#e25d5d", [side * 0.012, 0, -0.03], [0.4, 1, 1], 8);
    return bladeModel;
  };
  const bladeA = blade(1);
  const bladeB = blade(-1);
  hand.userData.snip = [bladeA, bladeB];
  return avatar;
}

/** Updates Figaro: his scissors hand twirls and snips at the air while he talks. */
export function animateBarber(a: Avatar, dt: number, t: number): void {
  a.update(dt, t);
  a.arms[1].rotation.x = -0.75 + Math.sin(t * 2.6) * 0.18;
  a.arms[1].rotation.z = -0.25;

  const [bladeA, bladeB] = a.arms[1].userData.snip as [Model, Model];
  const open = Math.max(0, Math.sin(t * 9)) * 0.35;
  bladeA.rotation.y = 0.05 + open;
  bladeB.rotation.y = -0.05 - open;
  a.head.rotation.y = Math.sin(t * 0.7) * 0.15;
}

/** A nylon cape over a sitter: shoulders, a collar, and a skirt that covers the lap and the knees. */
function cape(a: Avatar, colour: string, trim: string): void {
  const body = a.body;
  const shoulders = body.cyl(0.3, 0.52, colour, [0, 0.2, 0], 0.15, 16);
  shoulders.scale.set(1, 1, 0.85);
  body.cyl(0.16, 0.06, trim, [0, 0.75, 0], 0.15, 14);
  body.box([0.5, 0.05, 0.4], colour, [0, 0.46, 0.2], 0.02);
  body.box([0.5, 0.26, 0.04], colour, [0, 0.2, 0.4], 0.015);
  body.box([0.5, 0.025, 0.045], trim, [0, 0.2, 0.4], 0.008);
}

export interface Sitter {
  avatar: Avatar;
  update(dt: number, t: number): void;
}

/** A customer under a cape, in the chair; head turns a little, clippings fall. */
export function makeCustomer(
  skin: string,
  hair: string,
  style: number,
  capeColor: string,
  trim: string,
  beard = 0,
  seed = 0,
): Sitter {
  const look: Look = personLook({
    skin,
    hair,
    style,
    outfit: ["#4f8fe0", "#3a6fb8"],
    pants: "#3f4a63",
    hat: "none",
    beard,
  });
  const avatar = new Avatar(look);
  avatar.pose = "sit";
  cape(avatar, capeColor, trim);

  // Clippings falling from the cut.
  const rnd = seeded(seed + 7);
  const bits = Array.from({ length: 7 }, () => avatar.root.ball(0.012, hair, [0, 0, 0], [1, 1, 1], 4));
  const phase = bits.map(() => rnd());
  return {
    avatar,
    update(dt, t) {
      avatar.update(dt, t);
      avatar.arms[0].rotation.x = 0.1;
      avatar.arms[1].rotation.x = 0.1;
      avatar.head.rotation.y = Math.sin(t * 0.6 + seed) * 0.18;
      avatar.head.rotation.x = 0.12 + Math.sin(t * 0.9 + seed) * 0.04;
      bits.forEach((bit, index) => {
        const f = (t * 0.5 + phase[index]!) % 1;
        bit.position.set(
          Math.sin(phase[index]! * 40) * 0.12,
          0.62 - f * 0.55,
          0.05 + Math.cos(phase[index]! * 30) * 0.1,
        );
        bit.visible = f < 0.9;
      });
    },
  };
}

/** The apprentice with comb and scissors; he works the head in front of him. */
export function makeApprentice(skin: string, hair: string): Avatar {
  const look: Look = personLook({
    skin,
    hair,
    style: 1,
    outfit: ["#fbf7ef", "#d8d2c4"],
    pants: "#2b2f3a",
    hat: "none",
    beard: 0,
  });
  const avatar = new Avatar(look);
  barberApron(avatar, false);

  const rightArm = avatar.arms[1];
  const pivot = rightArm.part([0, -0.3, 0.07]);
  const blades: Model[] = [1, -1].map((side) => {
    const blade = pivot.part();
    blade.box([0.012, 0.03, 0.17], CHROME, [0, 0, 0], 0.002);
    blade.rotation.y = side * 0.1;
    return blade;
  });
  rightArm.userData.snip = blades;

  // The comb in the left hand, its teeth as a row of thin boxes.
  const leftArm = avatar.arms[0];
  leftArm.box([0.012, 0.03, 0.16], "#2b2433", [0, -0.3, 0.08], 0.003);
  for (let tooth = 0; tooth < 6; tooth++) {
    leftArm.box([0.01, 0.025, 0.006], "#2b2433", [0, -0.3, 0.01 + tooth * 0.026], 0.001);
  }
  return avatar;
}

/** The apprentice cuts: right arm up at the head snipping, left arm combing, a step to the side now and then. */
export function animateApprentice(a: Avatar, dt: number, t: number, phase = 0): void {
  const clock = t + phase;
  a.update(dt, clock);

  a.arms[1].rotation.x = -1.65 + Math.sin(clock * 1.3) * 0.12;
  a.arms[1].rotation.z = -0.2 + Math.sin(clock * 0.9) * 0.12;
  a.arms[0].rotation.x = -1.4 + Math.sin(clock * 1.3 + 1.6) * 0.14;
  a.arms[0].rotation.z = 0.2;

  const [bladeA, bladeB] = a.arms[1].userData.snip as [Model, Model];
  const open = Math.max(0, Math.sin(clock * 11)) * 0.38;
  bladeA.rotation.y = 0.05 + open;
  bladeB.rotation.y = -0.05 - open;
  a.head.rotation.x = 0.15;
  a.head.rotation.y = Math.sin(clock * 0.5) * 0.12;
}

/** Cut hair on the floor in a few colours, scattered round a spot. */
export function clippings(m: Model, colours: string[], at: [number, number], seed = 1): void {
  const rnd = seeded(seed);
  for (let i = 0; i < 16; i++) {
    const angle = rnd() * Math.PI * 2;
    const radius = 0.1 + rnd() * 0.45;
    const piece = m.box(
      [0.05 + rnd() * 0.04, 0.008, 0.02],
      colours[i % colours.length]!,
      [at[0] + Math.cos(angle) * radius, 0.003, at[1] + Math.sin(angle) * radius],
      0.002,
    );
    piece.rotation.y = rnd() * Math.PI;
    piece.castShadow = false;
  }
}

/** A push broom leaning on the wall. */
export function broom(): Model {
  const m = new Model();
  const handle = m.cyl(0.015, 1.2, C.wood, [0, 0.1, 0], 0.015, 6);
  handle.rotation.z = 0.12;
  m.box([0.34, 0.07, 0.07], "#d4a93a", [0.07, 0.05, 0], 0.02);
  m.box([0.36, 0.1, 0.09], "#8c5c36", [0.07, 0, 0], 0.02);
  return m;
}

/** Someone waiting on the sofa with a magazine. */
export function makeReader(): { avatar: Avatar; update(dt: number, t: number): void } {
  const look: Look = personLook({
    skin: "#c68a5f",
    hair: "#b2463d",
    style: 2,
    outfit: ["#58b36a", "#3f8c50"],
    pants: "#3f4a63",
    hat: "none",
    beard: 0,
    glasses: true,
  });
  const avatar = new Avatar(look);
  avatar.pose = "sit";

  const magazine = avatar.root.part([0, 0.55, 0.28]);
  magazine.rotation.x = -0.35;
  magazine.box([0.24, 0.3, 0.012], "#e25d5d", [0, 0, 0], 0.003);
  magazine.box([0.18, 0.06, 0.014], "#fbf7ef", [0, 0.2, 0.002], 0.002);

  return {
    avatar,
    update(dt, t) {
      avatar.update(dt, t);
      avatar.arms[0].rotation.x = -1.15;
      avatar.arms[1].rotation.x = -1.15;
      avatar.head.rotation.y = 0;
      avatar.head.rotation.x = 0.25 + Math.sin(t * 0.4) * 0.04;
      magazine.rotation.z = Math.sin(t * 0.8) * 0.02;
    },
  };
}
