/**
 * The Barber: a walk-in barber shop and salon in the 3D town. Every look option of the 2D character creator
 * (`hud/Bag.tsx`, its You tab: style, skin, hair) and every face thing of the shop (glasses, masks, the moustache and
 * the beard) is physically on show: wigs on stands in every hairstyle and hair colour, a colour swatch wall,
 * a skin-tone chart, a moustache and beard bar and a rack of faces, plus chairs, mirrors, sinks, towels and
 * clippers. Figaro the barber minds the till; two apprentices trim customers under capes.
 *
 * The catalogue is `data/barber.ts`. `restyle(look, change)` is the hook the buy panel uses to apply a
 * purchase to a saved 2D `Look`.
 */
import { LOOK_OPTIONS, type Look } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { type Asset, assetById, light } from "../furniture/furniture.ts";
import { canvasTexture, checker, glass, glow, Model, painted, ticks, tint } from "../kit/kit.ts";
import { panel } from "../kit/panel.ts";
import type { Avatar } from "../people/avatar.ts";
import { exitDoorway } from "../rooms/exits3d.ts";
import { type Placed, Room, type Turn } from "../rooms/room.ts";
import { nightGlow } from "../town/props.ts";
import {
  animateApprentice,
  animateBarber,
  BLUE,
  barberChair,
  barberPole,
  broom,
  CHROME,
  CHROME_DARK,
  chatter,
  clippings,
  headOnStand,
  leanCard,
  lipCard,
  lookOf,
  makeApprentice,
  makeBarber,
  makeCustomer,
  makeReader,
  mirror,
  nameChip,
  priceCard,
  RED,
  shelfUnit,
  sinks,
  station,
  towelWarmer,
  wig,
} from "./barber-parts.ts";
import {
  type BarberRow,
  FACE_ROWS,
  FACIAL_HAIR_IDS,
  HAIR_COLOURS,
  HAIR_ROWS,
  SKIN_COLOURS,
  SKIN_ROWS,
  STYLE_ROWS,
} from "./data/barber.ts";

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  level?: number;
  group?: string;
  /** a small 3D model of the item (for shelves/rails/pens and for the buy panel) */
  preview: () => Model;
}

export interface ShopSpec {
  id: "furniture" | "clothes" | "barber" | "pets";
  name: string;
  sign: string;
  items: ShopItem[];
  /**
   * The storefront for the town: a building about 5x4 tiles with a door on its south face, sign, awning and
   * window displays. Built facing +z like other town buildings (see town3d-houses.ts and town3d.ts).
   */
  exterior: () => Model;
  footprint: { w: number; d: number };
  /** The walkable interior. */
  buildInterior: () => {
    room: Room;
    /** world-grid tiles where a click means 'browse this item' */
    displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[];
    shopkeeper: Avatar;
    counter: [number, number];
    door: [number, number];
  };
}

const group = (row: BarberRow): string => {
  if (row.slot === "style") return "Hairstyles";
  if (row.slot === "hair") return "Hair colour";
  if (row.slot === "skin") return "Skin tone";

  const isFacialHair = (FACIAL_HAIR_IDS as readonly string[]).includes(row.id);
  return isFacialHair ? "Facial hair" : "Face";
};

const previewOf = (row: BarberRow): (() => Model) => {
  switch (row.slot) {
    case "style":
      return () => wig(row.index, 0);
    case "hair":
      return () => wig(0, row.index);
    case "skin":
      return () => headOnStand(lookOf(0, 0, row.index), { scale: 1.2 });
    case "glasses":
      return () => headOnStand(lookOf(0, 1, 1, row.index), { scale: 1.2, live: true });
  }
};

const toItem = (row: BarberRow): ShopItem => ({
  id: row.id,
  name: row.name,
  price: row.price,
  ...(row.level !== undefined && { level: row.level }),
  group: group(row),
  preview: previewOf(row),
});

const ROWS: readonly BarberRow[] = [...STYLE_ROWS, ...HAIR_ROWS, ...SKIN_ROWS, ...FACE_ROWS];
export const BARBER_ITEMS: ShopItem[] = ROWS.map(toItem);
const itemOf = (id: string): ShopItem => BARBER_ITEMS.find((item) => item.id === id)!;

/** What to change on a look: the creator's numbers, and the face thing (`look.glasses`; 0 takes it off). */
export interface LookChange {
  style?: number;
  hair?: number;
  skin?: number;
  /** A face item's index (`glasses.<n>`): glasses, masks, the moustache, the beard. */
  face?: number;
}

const inRange = (n: number | undefined, count: number): n is number =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n < count;

/**
 * A look with `change` applied: a new object, the old one untouched. Out-of-range numbers and face things
 * the barber does not stock are ignored. A level-locked face thing needs `opts.level`.
 */
export function restyle(look: Look, change: LookChange, opts: { level?: number } = {}): Look {
  const styled: Look = { ...look };
  if (inRange(change.style, LOOK_OPTIONS.style)) styled.style = change.style;
  if (inRange(change.hair, LOOK_OPTIONS.hair)) styled.hair = change.hair;
  if (inRange(change.skin, LOOK_OPTIONS.skin)) styled.skin = change.skin;

  if (change.face === 0) {
    styled.glasses = 0;
  } else if (change.face !== undefined) {
    const row = FACE_ROWS.find((entry) => entry.index === change.face);
    if (row && (row.level === undefined || (opts.level ?? 0) >= row.level)) styled.glasses = row.index;
  }
  return styled;
}

const BRICK = "#b5524a";
const TRIM = "#fbf7ef";

const stripes = (a: string, b: string, n = 8): THREE.CanvasTexture =>
  canvasTexture(n * 4, 8, (ctx) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect(i * 4, 0, 4, 8);
    }
  });

const brickTexture = (): THREE.CanvasTexture => {
  const texture = canvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = BRICK;
    ctx.fillRect(0, 0, 16, 16);

    // Mortar lines, with every other course offset by half a brick.
    ctx.fillStyle = tint(BRICK, -0.22);
    for (let course = 0; course < 4; course++) {
      ctx.fillRect(0, course * 4 + 3, 16, 1);
      const offset = course % 2 ? 4 : 0;
      for (let x = offset; x < 16; x += 8) ctx.fillRect(x, course * 4, 1, 3);
    }

    ctx.fillStyle = tint(BRICK, 0.1);
    for (let course = 0; course < 4; course++) ctx.fillRect(2 + (course % 2) * 4, course * 4, 2, 1);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

/** The storefront: 5 tiles wide, red brick, a striped awning, two window displays, the pole and the sign. */
function exterior(): Model {
  const m = new Model();
  m.name = "building:barber";
  const w = 5;
  const d = 3.6;
  const h = 2.0;

  m.box([w + 0.2, 0.16, d + 0.2], C.stone, [0, 0, -d / 2], 0.02);
  const body = m.box([w, h - 0.26, d], tint(BRICK, -0.05), [0, 0.16, -d / 2], 0.02);
  body.receiveShadow = true;

  const brick = brickTexture();
  brick.repeat.set(w * 1.2, (h - 0.16) * 1.2);
  const front = m.plane(w, h - 0.16, painted(brick), [0, 0.16 + (h - 0.16) / 2, 0.012]);
  front.receiveShadow = true;

  for (const side of [-1, 1]) {
    const sideBrick = brickTexture();
    sideBrick.repeat.set(d * 1.2, (h - 0.16) * 1.2);
    const wallPlane = m.plane(d, h - 0.16, painted(sideBrick), [
      side * (w / 2 + 0.012),
      0.16 + (h - 0.16) / 2,
      -d / 2,
    ]);
    wallPlane.rotation.y = side * (Math.PI / 2);
  }

  // Roof slab, parapets and a cornice along the front.
  m.box([w, 0.06, d], "#5d6470", [0, h - 0.066, -d / 2], 0.005);
  m.box([w + 0.14, 0.1, 0.16], TRIM, [0, h - 0.1, 0], 0.02);
  m.box([w + 0.04, 0.22, 0.12], BRICK, [0, h - 0.04, -0.04], 0.02);
  m.box([w + 0.04, 0.22, 0.12], BRICK, [0, h - 0.04, -d + 0.04], 0.02);
  for (const side of [-1, 1]) m.box([0.12, 0.22, d], BRICK, [side * (w / 2), h - 0.04, -d / 2], 0.02);

  // Black-and-white tiles under the windows.
  const base = canvasTexture(8, 2, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#2b2f3a" : "#f1ede0";
      ctx.fillRect(i, 0, 1, 1);
      ctx.fillStyle = i % 2 ? "#f1ede0" : "#2b2f3a";
      ctx.fillRect(i, 1, 1, 1);
    }
  });
  base.wrapS = THREE.RepeatWrapping;
  base.wrapT = THREE.RepeatWrapping;
  base.repeat.set(w * 1.6, 1);
  m.plane(w, 0.3, painted(base), [0, 0.31, 0.025]);

  // The windows, with a wig head or two in each. Each entry is [x, hair, style, skin].
  const face = m.part([0, 0, 0.02]);
  const heads: Array<[number, number, number, number]> = [
    [-1.85, 0, 1, 3],
    [-1.2, 1, 3, 1],
    [1.2, 5, 0, 2],
    [1.85, 2, 2, 0],
  ];
  for (const sx of [-1.52, 1.52]) {
    face.box([1.24, 0.8, 0.08], TRIM, [sx, 0.36, 0], 0.02);
    const dark = face.box([1.1, 0.66, 0.06], "#3a2a2e", [sx, 0.43, 0.016], 0.01);
    dark.castShadow = false;
    const pane = face.box([1.08, 0.64, 0.02], glass("#cfe8f4", 0.28), [sx, 0.44, 0.07], 0.004);
    pane.castShadow = false;
    nightGlow(pane, "#ffd98a");
    face.box([1.3, 0.06, 0.16], TRIM, [sx, 0.3, 0.07], 0.015);
    face.box([1.1, 0.04, 0.26], C.woodDark, [sx, 0.46, -0.1], 0.01);

    const miniMirror = mirror(0.36, 0.5, false);
    miniMirror.scale.setScalar(0.8);
    miniMirror.position.set(sx, 0.5, -0.2);
    face.add(miniMirror);
  }
  for (const [x, hair, style, skin] of heads) {
    const hd = headOnStand(lookOf(style, hair, skin, 0, hair), {
      voxelStyle: style === 2 ? 3 : undefined,
      scale: 0.9,
    });
    hd.scale.setScalar(0.85);
    hd.position.set(x, 0.5, -0.05);
    face.add(hd);
  }

  // Flower boxes.
  for (const sx of [-1.52, 1.52]) {
    face.box([1.1, 0.12, 0.14], C.woodDark, [sx, 0.2, 0.14], 0.02);
    for (let bloom = 0; bloom < 6; bloom++) {
      face.ball(
        0.05,
        ["#e8584f", "#f5d14a", "#ff7ab6"][bloom % 3]!,
        [sx - 0.45 + bloom * 0.18, 0.36, 0.14],
        [1, 1, 1],
        6,
      );
    }
  }

  // The door: glass panel, kick plate, brass handle, and a hanging sign.
  const door = m.part([0, 0.16, 0.02]);
  door.box([0.88, 1.12, 0.08], TRIM, [0, 0, 0], 0.02);
  door.box([0.72, 1.02, 0.06], "#2e5fa8", [0, 0, 0.02], 0.015);
  const doorPane = door.box([0.5, 0.6, 0.02], glass("#cfe8f4", 0.5), [0, 0.32, 0.06], 0.004);
  nightGlow(doorPane, "#ffd98a");
  door.box([0.62, 0.2, 0.02], tint("#2e5fa8", -0.2), [0, 0.04, 0.06], 0.005);
  door.box([0.04, 0.2, 0.04], "#e9b73d", [0.27, 0.5, 0.1], 0.01);
  door.box([1.1, 0.08, 0.4], C.stoneLight, [0, 0, 0.16], 0.02);

  const openSign = door.part([-0.18, 0.62, 0.1]);
  openSign.box([0.28, 0.12, 0.02], "#fbf7ef", [0, 0, 0], 0.01);
  ticks.push((t) => {
    openSign.rotation.z = Math.sin(t * 1.5) * 0.04;
  });

  // The awning: red and white, scalloped, over the whole front.
  const awning = m.part([0, 1.5, 0.03]);
  awning.rotation.x = 0.4;
  const stripeTexture = stripes(RED, "#fbf7ef", 20);
  stripeTexture.wrapS = THREE.RepeatWrapping;
  awning.box([w - 0.1, 0.05, 0.48], painted(stripeTexture), [0, -0.025, 0.24], 0.01);
  for (let i = 0; i < 20; i++) {
    const x = -((w - 0.1) / 2) + (i + 0.5) * ((w - 0.1) / 20);
    const scallop = awning.cyl(0.125, 0.05, i % 2 ? "#fbf7ef" : RED, [x, -0.06, 0.5], 0.125, 3);
    scallop.rotation.x = Math.PI / 2;
  }

  // The sign above the awning: BARBER, with a pair of scissors each side.
  const signTex = canvasTexture(
    512,
    96,
    (ctx) => {
      ctx.fillStyle = "#1f2a44";
      ctx.beginPath();
      ctx.roundRect(0, 0, 512, 96, 18);
      ctx.fill();
      ctx.strokeStyle = "#f5c842";
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, 496, 80);

      ctx.fillStyle = "#fbf7ef";
      ctx.font = "900 52px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BARBER & SALON", 256, 40);
      ctx.fillStyle = "#f5c842";
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillText("cuts  ·  colour  ·  beards  ·  faces", 256, 74);
    },
    true,
  );
  m.box([3.4, 0.4, 0.06], "#1f2a44", [0, 1.52, 0.03], 0.02);
  m.plane(3.34, 0.36, glow("#fff", signTex), [0, 1.72, 0.07]);

  const roofPole = m.part([0, h + 0.3, -0.12]);
  for (const side of [-1, 1]) {
    const blade = roofPole.box([0.04, 0.5, 0.03], CHROME, [0, -0.1, 0], 0.005);
    blade.rotation.z = side * 0.28;
    roofPole.ball(0.07, RED, [-side * 0.14, -0.02, 0], [1, 1.2, 0.5], 8);
  }

  // The barber pole on the wall, right of the right window, spinning.
  const bracket = m.part([2.32, 0.3, 0.06]);
  bracket.box([0.06, 0.06, 0.2], CHROME_DARK, [0, 0, 0], 0.01);
  bracket.box([0.06, 0.06, 0.2], CHROME_DARK, [0, 1.0, 0], 0.01);
  const pole = barberPole(1.05, 0.085, true);
  pole.position.set(0, 0, 0.14);
  bracket.add(pole);

  // A second, free-standing one on the kerb.
  const kerb = barberPole(0.7, 0.07);
  kerb.position.set(-2.2, 0, 0.7);
  m.add(kerb);
  m.box([0.24, 0.05, 0.24], "#2b2433", [-2.2, 0, 0.7], 0.01);

  // The chalkboard A-frame: today's walk-ins.
  const board = panel(
    0.9,
    1.05,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#2f3b37";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#f1ede0";
      ctx.textAlign = "center";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("WALK-INS", cw / 2, 22);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#ffe28a";
      for (const [index, line] of ["Trim", "Colour", "Beard", "New face"].entries()) {
        ctx.fillText(line, cw / 2, 44 + index * 18);
      }
      ctx.fillStyle = "#f08a8a";
      ctx.fillText("free styles!", cw / 2, ch - 12);
    },
    { px: 96, frame: C.woodDark },
  );
  board.position.set(-1.2, 0, 0.8);
  m.add(board);

  // Lanterns each side of the door.
  for (const x of [-0.62, 0.62]) {
    m.box([0.04, 0.12, 0.04], C.metal, [x, 1.0, 0.07]);
    nightGlow(m.box([0.12, 0.16, 0.12], "#f5d98a", [x, 0.84, 0.1], 0.03), "#ffe28a");
  }
  light(m, [0, 1.0, 0.9], "#ffcf7a", 2.6, 6);
  return m;
}

const W = 20;
const D = 11;

const asset = (
  id: string,
  name: string,
  w: number,
  d: number,
  build: () => Model,
  extra: Partial<Asset> = {},
): Asset => ({
  id,
  name,
  price: 0,
  w,
  d,
  build,
  ...extra,
});

/** A header sign on top of a fixture: a lit board, `w` wide. */
function header(
  m: Model,
  text: string,
  sub: string,
  w: number,
  y: number,
  z: number,
  colour = "#1f2a44",
): void {
  const plate = panel(
    w,
    0.26,
    (ctx, cw, ch) => {
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#f5c842";
      ctx.fillRect(0, ch - 3, cw, 3);
      ctx.fillStyle = "#fbf7ef";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Shrinks the font until the line fits the board, down to 6 px.
      const fitLine = (size: number, weight: string, line: string) => {
        let current = size;
        ctx.font = `${weight} ${current}px system-ui, sans-serif`;
        while (ctx.measureText(line).width > cw - 12 && current > 6) {
          current -= 1;
          ctx.font = `${weight} ${current}px system-ui, sans-serif`;
        }
      };

      fitLine(14, "900", text);
      ctx.fillText(text, cw / 2, ch * 0.36);
      ctx.fillStyle = "#f5c842";
      fitLine(9, "600", sub);
      ctx.fillText(sub, cw / 2, ch * 0.76);
    },
    { px: 64, lit: true, frame: "#5b3a24" },
  );
  plate.position.set(0, y, z);
  m.add(plate);
}

/** What each display shows, by row id, as the racks put it out: where the pointer finds it (`buildInterior`). */
const spots = new Map<string, THREE.Object3D[]>();
const spot = (id: string, part: THREE.Object3D) => spots.set(id, [...(spots.get(id) ?? []), part]);

/** The wig wall: four hairstyle rows by six hair colours, 24 heads, a price card under each. */
function wigWall(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.22, 0.84, 1.46, 2.08];
  const unit = shelfUnit(6, depth, tiers, { cabinet: 0.15, top: 2.62, back: "#f1e6d2" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);

  const wall = m.part([0, 0, -0.5]);
  STYLE_ROWS.forEach((row, rowIndex) => {
    const y = tiers[rowIndex]!;
    leanCard(wall, row, [-2.62, y, 0.52], 0.66, 0.34);

    HAIR_ROWS.forEach((hair, column) => {
      const wigModel = wig(row.index, hair.index);
      wigModel.scale.setScalar(0.86);
      wigModel.rotation.y = -0.5;
      wigModel.position.set(-1.8 + column * 0.82, y, 0.25);
      wall.add(wigModel);
      spot(row.id, wigModel);

      leanCard(
        wall,
        { ...hair, name: hair.name.replace(" hair", "") },
        [-1.8 + column * 0.82, y, 0.52],
        0.76,
        0.2,
      );
    });
  });
  light(m, [0, 2.4, 0.6], "#fff0cf", 1.6, 5);
  return m;
}

/** The colour swatch wall: pegboard, six hair tresses, their cards, and a bottle of dye for each. */
function swatchWall(): Model {
  const m = new Model();
  const depth = 0.5;
  const unit = shelfUnit(4, depth, [0.55], { cabinet: 0.5, top: 2.45, wood: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);

  const wall = m.part([0, 0, -0.5]);

  // The pegboard: a grid of holes.
  const holes = canvasTexture(32, 24, (ctx) => {
    ctx.fillStyle = "#efe4cb";
    ctx.fillRect(0, 0, 32, 24);
    ctx.fillStyle = "#cdbd9c";
    for (let x = 1; x < 32; x += 2) {
      for (let y = 1; y < 24; y += 2) ctx.fillRect(x, y, 1, 1);
    }
  });
  const pegboard = m.plane(3.88, 1.82, painted(holes), [0, 1.5, -0.5 + 0.1]);
  pegboard.position.z = -0.5 + 0.095;
  header(m, "HAIR COLOUR", "six shades, all free", 2.2, 2.15, -0.5 + 0.53);

  HAIR_ROWS.forEach((row, column) => {
    const x = -1.6 + column * 0.64;
    const col = HAIR_COLOURS[column]!;

    // The clip, then the tress: a wavy plait of cubes.
    for (let segment = 0; segment < 6; segment++) {
      const seg = wall.box(
        [0.17 - segment * 0.012, 0.11, 0.07],
        tint(col, segment % 2 ? -0.12 : 0.08),
        [x + Math.sin(segment * 1.4) * 0.022, 1.72 - segment * 0.09, 0.13],
        0.015,
      );
      seg.castShadow = true;
    }
    spot(row.id, wall.box([0.07, 0.07, 0.06], tint(col, -0.2), [x, 1.17, 0.13], 0.02));
    spot(row.id, wall.box([0.22, 0.05, 0.05], CHROME, [x, 1.82, 0.12], 0.01));

    const card = priceCard({ ...row, name: row.name.replace(" hair", "") }, 0.56, 0.42);
    card.position.set(x, 0.74, 0.11);
    wall.add(card);

    // The dye bottle on the shelf, and a tub.
    wall.cyl(0.07, 0.24, glass(col, 0.9), [x - 0.1, 0.6, 0.3], 0.065, 10);
    wall.cyl(0.04, 0.05, "#fbf7ef", [x - 0.1, 0.84, 0.3], 0.03, 8);
    wall.cyl(0.1, 0.1, "#fbf7ef", [x + 0.1, 0.6, 0.26], 0.09, 10);
    wall.cyl(0.085, 0.015, col, [x + 0.1, 0.7, 0.26], 0.085, 10);
  });
  light(m, [0, 2.1, 0.5], "#fff0cf", 1.0, 4);
  return m;
}

/** The face rack: eighteen faces on three boards, a card on each board's lip, the sign on the cabinet. */
function faceRack(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.36, 1.12, 1.88];
  const unit = shelfUnit(6, depth, tiers, { cabinet: 0.3, top: 2.56, wood: "#bda27a", back: "#f1e6d2" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);

  const wall = m.part([0, 0, -0.5]);
  header(m, "FACES", "glasses, masks & goggles, new for every day", 3.0, 0.04, -0.5 + depth + 0.03);

  const plainFaces = FACE_ROWS.filter(
    (faceRow) => !(FACIAL_HAIR_IDS as readonly string[]).includes(faceRow.id),
  );
  plainFaces.forEach((row, index) => {
    const tier = Math.floor(index / 6);
    const column = index % 6;
    const x = -2.5 + column;

    const head = headOnStand(lookOf(index % 4, (index * 5) % 6, index % 4, row.index, index % 8), {
      scale: 0.95,
      live: true,
    });
    head.position.set(x, tiers[tier]!, 0.22);
    head.rotation.y = -0.2;
    wall.add(head);
    spot(row.id, head);
    lipCard(wall, row, [x, tiers[tier]! - 0.3, depth + 0.012], 0.92, 0.26);
  });
  light(m, [0, 2.3, 0.6], "#fff0cf", 1.4, 5);
  return m;
}

/** The moustache and beard bar: both on show in two hair colours, plus the razors, brush, soap and strop. */
function beardBar(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.5, 1.4];
  const top = 2.5;
  const unit = shelfUnit(2, depth, tiers, { cabinet: 0.35, top, wood: "#7a5a44", back: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);

  const wall = m.part([0, 0, -0.5]);
  header(
    m,
    "MOUSTACHE & BEARD",
    "grown in your own hair colour",
    1.86,
    top - 0.3,
    -0.5 + depth + 0.03,
    "#3a2a1c",
  );
  const [moustache, beard] = FACE_ROWS.filter((faceRow) =>
    (FACIAL_HAIR_IDS as readonly string[]).includes(faceRow.id),
  ) as [BarberRow, BarberRow];

  // The shaving kit between the moustaches: a mug with its brush, a bar of soap, an open razor.
  const shelfY = tiers[0]!;
  wall.cyl(0.06, 0.09, "#fbf7ef", [-0.07, shelfY, 0.36], 0.055, 12);
  wall.cyl(0.052, 0.012, "#f1f1f1", [-0.07, shelfY + 0.09, 0.36], 0.05, 12);
  wall.cyl(0.011, 0.15, "#8c5c36", [-0.07, shelfY + 0.09, 0.36], 0.011, 6);
  wall.ball(0.03, "#e8dcc4", [-0.07, shelfY + 0.25, 0.36], [1, 1.3, 1], 8);
  wall.box([0.09, 0.035, 0.055], "#f5d98a", [0.09, shelfY, 0.38], 0.012);
  const razor = wall.part([0, shelfY + 0.01, 0.15], 0.5);
  razor.box([0.18, 0.012, 0.03], CHROME, [0, 0, 0], 0.002);
  razor.box([0.09, 0.02, 0.025], "#2b2433", [0.13, 0, 0], 0.005);

  const rows: [BarberRow, readonly number[], number][] = [
    [moustache, [1, 3], tiers[0]!],
    [beard, [5, 4], tiers[1]!],
  ];
  for (const [row, hairs, y] of rows) {
    for (const [slot, hair] of hairs.entries()) {
      const head = headOnStand(lookOf(0, hair, slot === 0 ? 1 : 2, row.index, 0), { scale: 1.0, live: true });
      head.position.set(-0.5 + slot * 1.0, y, 0.22);
      head.rotation.y = slot ? 0.15 : -0.15;
      wall.add(head);
      spot(row.id, head);
    }
    lipCard(wall, row, [0, y - 0.3, depth + 0.012], 0.92, 0.26);
  }
  return m;
}

/** The skin-tone chart: four tones on heads in a cabinet, a card under each, and a chip each on the doors. */
function skinChart(): Model {
  const m = new Model();
  const depth = 0.55;
  const tiers = [0.72, 1.5];
  const top = 2.4;
  const unit = shelfUnit(2, depth, tiers, { cabinet: 0.4, top, wood: "#e6d8bd" });
  unit.position.z = -0.5 + depth / 2;
  m.add(unit);

  const wall = m.part([0, 0, -0.5]);
  header(m, "SKIN TONE", "four shades, free", 1.5, top - 0.3, -0.5 + depth + 0.03);
  for (const [index, row] of SKIN_ROWS.entries()) {
    const tier = Math.floor(index / 2);
    const x = -0.5 + (index % 2) * 1.0;

    const head = headOnStand(lookOf(0, 0, row.index, 0, 3), { scale: 1.0 });
    head.position.set(x, tiers[tier]!, 0.22);
    head.rotation.y = index % 2 ? 0.15 : -0.15;
    wall.add(head);
    spot(row.id, head);
    lipCard(
      wall,
      { ...row, name: row.name.replace(" skin", "") },
      [x, tiers[tier]! - 0.2, depth + 0.012],
      0.8,
      0.16,
    );
  }

  // The four tones as chips on the cabinet doors.
  for (let chip = 0; chip < 4; chip++) {
    wall.box([0.3, 0.2, 0.015], SKIN_COLOURS[chip]!, [-0.66 + chip * 0.44, 0.08, depth + 0.02], 0.006);
  }
  return m;
}

function counter(): Model {
  const m = new Model();
  const w = 4;
  m.box([w, 0.9, 0.7], "#f1ede0", [0, 0, 0], 0.03);
  m.box([w + 0.1, 0.06, 0.8], "#2b2f3a", [0, 0.9, 0], 0.02);
  m.box([w - 0.2, 0.7, 0.03], "#1f2a44", [0, 0.1, 0.36], 0.01);
  for (let post = 0; post < 8; post++) {
    m.box([0.03, 0.7, 0.035], post % 2 ? RED : "#fbf7ef", [-w / 2 + 0.3 + post * 0.5, 0.1, 0.37], 0.004);
  }

  // The till.
  m.box([0.5, 0.2, 0.4], "#8a93a1", [-1.2, 0.96, 0], 0.03);
  const screen = m.box([0.4, 0.22, 0.04], "#2b2433", [-1.2, 1.16, -0.12], 0.01);
  screen.rotation.x = -0.35;
  m.box([0.3, 0.02, 0.1], "#3ddc84", [-1.2, 1.2, -0.1], 0.004);
  m.box([0.4, 0.04, 0.08], "#fbf7ef", [-1.2, 1.0, 0.17], 0.01);

  // A bell, a tip jar, business cards, a small pole and a jar of lollipops.
  m.cyl(0.06, 0.04, "#e9b73d", [-0.6, 0.96, 0.1], 0.03, 10);
  m.ball(0.03, "#e9b73d", [-0.6, 1.0, 0.1], [1, 1, 1], 6);
  m.cyl(0.08, 0.18, glass("#d6ecf6", 0.6), [-0.2, 0.96, 0.1], 0.08, 12);
  for (let coin = 0; coin < 4; coin++) {
    m.cyl(0.045, 0.012, "#f5c842", [-0.2, 0.97 + coin * 0.012, 0.1], 0.045, 10);
  }
  m.box([0.14, 0.02, 0.09], "#fbf7ef", [0.3, 0.96, 0.15], 0.004);
  const cards = m.box([0.14, 0.03, 0.09], "#f5d98a", [0.3, 0.98, 0.15], 0.004);
  cards.rotation.y = 0.2;

  const pole = barberPole(0.5, 0.06);
  pole.position.set(1.4, 0.96, 0);
  m.add(pole);

  m.cyl(0.09, 0.22, glass("#fbd7e6", 0.6), [0.8, 0.96, 0.05], 0.09, 12);
  for (let pop = 0; pop < 5; pop++) {
    const lollipop = m.ball(
      0.04,
      ["#e8584f", "#f5d14a", "#58b36a", "#4f8fe0", "#c86bd8"][pop]!,
      [0.8 + (pop - 2) * 0.03, 1.2 + (pop % 2) * 0.03, 0.05],
      [1, 1, 0.5],
      8,
    );
    lollipop.castShadow = true;
    m.cyl(0.006, 0.12, "#fbf7ef", [0.8 + (pop - 2) * 0.03, 1.1, 0.05], 0.006, 4);
  }
  light(m, [0, 1.9, -0.4], "#ffe3b0", 1.4, 5);
  return m;
}

function priceBoard(): Model {
  const m = new Model();
  const plate = panel(
    1.3,
    1.5,
    (ctx, cw, ch) => {
      ctx.fillStyle = "#2f3b37";
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = "#c98e22";
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, cw - 6, ch - 6);

      ctx.fillStyle = "#ffe28a";
      ctx.textAlign = "center";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText("THE MENU", cw / 2, 28);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#f1ede0";
      const menu = [
        ["Hairstyle", "free"],
        ["Hair colour", "free"],
        ["Skin tone", "free"],
        ["Hygge moustache", "100"],
        ["Viking beard", "380"],
        ["Nerd specs", "60"],
        ["Shades", "100"],
        ["Heart glasses", "150"],
        ["Bot mask", "950"],
        ["Laser eyes", "1800"],
      ] as const;
      menu.forEach(([label, price], index) => {
        ctx.textAlign = "left";
        ctx.fillText(label, 12, 56 + index * 17);
        ctx.textAlign = "right";
        ctx.fillStyle = price === "free" ? "#8fe3a0" : "#f5c842";
        ctx.fillText(price, cw - 12, 56 + index * 17);
        ctx.fillStyle = "#f1ede0";
      });
    },
    { px: 96, frame: "#5b3a24" },
  );
  plate.position.set(0, 0.5, 0);
  m.add(plate);
  m.box([0.05, 0.5, 0.05], C.woodDark, [-0.5, 0, -0.04], 0.01);
  m.box([0.05, 0.5, 0.05], C.woodDark, [0.5, 0, -0.04], 0.01);
  return m;
}

function magazineTable(): Model {
  const m = new Model();
  m.cyl(0.35, 0.05, C.woodDark, [0, 0.4, 0], 0.35, 14);
  m.cyl(0.04, 0.4, C.woodDark, [0, 0, 0], 0.04, 8);
  m.cyl(0.18, 0.03, C.woodDark, [0, 0, 0], 0.18, 10);
  for (const [index, color] of [RED, BLUE, "#f5c842"].entries()) {
    const magazine = m.box([0.22, 0.012, 0.3], color, [-0.1 + index * 0.1, 0.45 + index * 0.012, 0], 0.003);
    magazine.rotation.y = index * 0.5 - 0.4;
  }
  return m;
}

function buildInterior(): ReturnType<ShopSpec["buildInterior"]> {
  const room = new Room(W, D, { floor: "#3b4150", wall: "#c3e0d4", stripe: "#a6cdbd", bare: true });
  room.setDecor({ floor: { texture: checker("#eee6d4", "#3b4150", 4), span: 4, color: "#9aa3ad" } });
  const displays: { item: ShopItem; at: [number, number]; world?: [number, number, number] }[] = [];
  spots.clear();
  const put = (piece: Asset, x: number, z: number, turn: Turn = 0) => room.place(piece, x, z, turn);

  // North wall: wigs, swatches, faces, beards, skin.
  put(asset("barber:wigs", "Wig wall", 6, 1, wigWall), 0, 0);
  put(asset("barber:swatches", "Colour swatch wall", 4, 1, swatchWall), 6, 0);
  put(asset("barber:faces", "Face rack", 6, 1, faceRack), 10, 0);
  put(asset("barber:beards", "Moustache and beard bar", 2, 1, beardBar), 16, 0);
  put(asset("barber:skin", "Skin-tone chart", 2, 1, skinChart), 18, 0);

  const show = (row: BarberRow, at: [number, number]) => {
    displays.push({ item: itemOf(row.id), at });
  };
  for (const [index, row] of STYLE_ROWS.entries()) show(row, [1 + index, 1]);
  for (const [index, row] of HAIR_ROWS.entries()) show(row, [6 + Math.round((index * 3) / 5), 1]);
  const plainFaces = FACE_ROWS.filter((row) => !(FACIAL_HAIR_IDS as readonly string[]).includes(row.id));
  for (const [index, row] of plainFaces.entries()) show(row, [10 + (index % 6), 1]);
  for (const [index, id] of FACIAL_HAIR_IDS.entries()) {
    show(
      FACE_ROWS.find((row) => row.id === id)!,
      [16 + index, 1],
    );
  }
  for (const [index, row] of SKIN_ROWS.entries()) show(row, [18 + (index % 2), 1]);

  // West wall: three mirror stations, a chair each, the shampoo sinks and the towel warmer.
  const chairs: Placed[] = [];
  for (const [index, z] of [1, 3, 5].entries()) {
    put(
      asset(`barber:station-${index}`, "Mirror station", 2, 1, () => station(index)),
      0,
      z,
      1,
    );
    chairs.push(
      put(
        asset(`barber:chair-${index}`, "Barber chair", 2, 1, barberChair, {
          seat: { at: [0, 0.52, 0], turn: 0 },
        }),
        1,
        z,
        3,
      ),
    );
  }
  put(asset("barber:sinks", "Shampoo sinks", 2, 1, sinks), 0, 7, 1);
  put(asset("barber:towels", "Hot towel cabinet", 1, 1, towelWarmer), 0, 9, 1);
  put(assetById.get("plant")!, 0, 10);

  // The seats' customers and the apprentices.
  const hairFloor: [number, number][] = [];
  const customers: { avatar: Avatar; update: (dt: number, t: number) => void }[] = [];
  const helpers: { avatar: Avatar; phase: number }[] = [];
  const seatAt = (placed: Placed) => room.seatOf(placed)!.at;
  const seated = [
    { skin: SKIN_COLOURS[2]!, hair: HAIR_COLOURS[4]!, style: 0, cape: BLUE, trim: "#fbf7ef", beard: 1 },
    { skin: SKIN_COLOURS[0]!, hair: HAIR_COLOURS[2]!, style: 2, cape: "#2b2433", trim: "#f5c842", beard: 0 },
  ];
  seated.forEach((customer, index) => {
    const at = seatAt(chairs[index]!);
    const sitter = makeCustomer(
      customer.skin,
      customer.hair,
      customer.style,
      customer.cape,
      customer.trim,
      customer.beard,
      index,
    );
    sitter.avatar.root.position.set(at.x + 0.1, 0.5, at.z);
    sitter.avatar.root.rotation.y = -Math.PI / 2;
    room.group.add(sitter.avatar.root);
    customers.push(sitter);

    const apprentice = makeApprentice(
      index ? SKIN_COLOURS[1]! : SKIN_COLOURS[3]!,
      index ? HAIR_COLOURS[1]! : HAIR_COLOURS[0]!,
    );
    apprentice.root.position.set(at.x + 0.62, 0.02, at.z + (index ? -0.1 : 0.1));
    apprentice.root.rotation.y = -Math.PI / 2;
    room.group.add(apprentice.root);
    helpers.push({ avatar: apprentice, phase: index * 1.7 });
    nameChip(apprentice, index ? "Mads" : "Freja", "apprentice");
    hairFloor.push([at.x + 0.2, at.z]);
  });

  // The third chair waits, with a cape folded on it.
  const waitingSeat = seatAt(chairs[2]!);
  hairFloor.push([waitingSeat.x + 0.2, waitingSeat.z]);
  const waitingCape = new Model();
  waitingCape.box([0.46, 0.04, 0.34], RED, [0, 0, 0], 0.015);
  waitingCape.position.set(waitingSeat.x, 0.52, waitingSeat.z);
  room.group.add(waitingCape);

  const hairOnFloor = new Model();
  clippings(hairOnFloor, [...HAIR_COLOURS], hairFloor[0]!, 3);
  clippings(hairOnFloor, [HAIR_COLOURS[2]!, HAIR_COLOURS[0]!], hairFloor[1]!, 5);
  clippings(hairOnFloor, [HAIR_COLOURS[1]!], hairFloor[2]!, 9);
  room.group.add(hairOnFloor);

  const sweeper = broom();
  sweeper.position.set(1.0, 0.02, 8.9);
  sweeper.rotation.set(0, 0.4, 0.7);
  room.group.add(sweeper);

  // South-east: the counter, the shopkeeper behind it, the menu, the door.
  const counterAt: [number, number] = [15, 8];
  put(asset("barber:counter", "Counter", 4, 1, counter), 14, 8);
  put(asset("barber:menu", "The menu", 1, 1, priceBoard), 18, 8);
  put(assetById.get("plant")!, 19, 9);

  const doorAt: [number, number] = [10, 10];
  const door = exitDoorway({ outside: true, wall: "#c3e0d4", leaf: BLUE });
  door.position.set(10.5, 0, D + 0.5);
  door.rotation.y = Math.PI;
  room.group.add(door);
  put(assetById.get("lamp")!, 12, 10);

  // The waiting corner, east: sofa, magazine table, plant, and someone waiting.
  const sofa = put(assetById.get("sofa")!, 18, 3, 3);
  put(asset("barber:mag-table", "Magazine table", 1, 1, magazineTable), 16, 4);
  put(assetById.get("plant")!, 19, 1);
  put(assetById.get("rug")!, 16, 2);
  put(assetById.get("rug")!, 9, 8);

  const reader = makeReader();
  const readerSeat = room.seatOf(sofa)!;
  reader.avatar.root.position.set(readerSeat.at.x, readerSeat.at.y - 0.02, readerSeat.at.z);
  reader.avatar.root.rotation.y = readerSeat.turn;
  room.group.add(reader.avatar.root);

  // Figaro, at the till.
  const barber = makeBarber();
  barber.root.position.set(16.0, 0.02, 7.55);
  room.group.add(barber.root);
  nameChip(barber, "Figaro", "barber");
  chatter(barber, [
    "Welcome in! Trim, colour or a brand new face?",
    "Every style is free. The moustache is a hundred coins.",
    "Lean back, I will have you looking sharp.",
    "Hot towel with every beard.",
  ]);

  // Everyone moves.
  let lastTick = 0;
  ticks.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - lastTick));
    lastTick = t;
    animateBarber(barber, dt, t);
    for (const customer of customers) customer.update(dt, t);
    reader.update(dt, t);
    for (const helper of helpers) animateApprentice(helper.avatar, dt, t, helper.phase);
  });

  // Each display where its things stand, in the room's own frame: the middle of all of them (a style's row of
  // wigs, a moustache's two heads), not its floor tile.
  room.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const display of displays) {
    const parts = spots.get(display.item.id);
    if (!parts) continue;

    box.makeEmpty();
    for (const part of parts) box.expandByObject(part);
    const center = box.getCenter(new THREE.Vector3());
    display.world = [center.x, center.y, center.z];
  }

  return { room, displays, shopkeeper: barber, counter: counterAt, door: doorAt };
}

export const SHOP_BARBER: ShopSpec = {
  id: "barber",
  name: "The Barber",
  sign: "BARBER & SALON",
  items: BARBER_ITEMS,
  exterior,
  footprint: { w: 5, d: 4 },
  buildInterior,
};
