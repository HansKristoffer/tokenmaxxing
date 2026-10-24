/**
 * The town outside, after the reference towns: a square with the grand fountain, the arcade, company
 * houses with fenced yards, a terrace lounge, a road with traffic, and a park of hedges and flower beds,
 * all ringed by forest. Houses grow by tier (`houseTier`).
 */
import * as THREE from "three";
import { C } from "../art/palette.ts";
import { canvasTexture, glow, Model, painted, seeded, tint, toon } from "./kit.ts";
import {
  arcadeBuilding,
  bar,
  bush,
  cypress,
  djBooth,
  flowerBed,
  grandFountain,
  hedge,
  hotDogCart,
  lanternPillar,
  lanternTable,
  loungeSofa,
  mailbox,
  nightGlow,
  palm,
  parkBench,
  pergola,
  picnic,
  pond,
  setPropsNight,
  stool,
  streetLamp,
  type TreeKind,
  topiary,
  trashBin,
  tree,
} from "./props.ts";

export function setTownNight(night: boolean): void {
  setPropsNight(night);
}

/** Mown grass: soft stripes a tile wide, with a little noise. Two tiles per texture. */
function lawn(): THREE.CanvasTexture {
  const rnd = seeded(7);
  const t = canvasTexture(
    128,
    128,
    (g) => {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? "#6cbf4e" : "#62b546";
        g.fillRect(0, i * 32, 128, 32);
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(40, 110, 40, 0.25)" : "rgba(170, 230, 120, 0.25)";
        g.fillRect(rnd() * 128, rnd() * 128, 1.5, 3);
      }
    },
    true,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Square paving: `px` texels a tile, slabs in a few close greys, with joints. */
function paving(base: string, joint: string, seed: number, inlay?: string): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const t = canvasTexture(
    128,
    128,
    (g) => {
      g.fillStyle = joint;
      g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          g.fillStyle = tint(base, (rnd() - 0.5) * 0.08);
          g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
          g.fillStyle = "rgba(255,255,255,0.08)";
          g.fillRect(x * 32 + 1, y * 32 + 1, 30, 3);
        }
      if (inlay) {
        g.strokeStyle = inlay;
        g.lineWidth = 4;
        for (const [cx, cy] of [
          [32, 32],
          [96, 96],
          [32, 96],
          [96, 32],
        ] as const) {
          g.beginPath();
          g.moveTo(cx, cy - 22);
          g.lineTo(cx + 22, cy);
          g.lineTo(cx, cy + 22);
          g.lineTo(cx - 22, cy);
          g.closePath();
          g.stroke();
        }
      }
    },
    true,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function asphalt(): THREE.CanvasTexture {
  const rnd = seeded(9);
  const t = canvasTexture(
    128,
    128,
    (g) => {
      g.fillStyle = "#4a4e58";
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 1200; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.07)";
        g.fillRect(rnd() * 128, rnd() * 128, 1.5, 1.5);
      }
    },
    true,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function deck(): THREE.CanvasTexture {
  const rnd = seeded(4);
  const t = canvasTexture(
    128,
    128,
    (g) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = tint("#b98a52", (rnd() - 0.5) * 0.12);
        g.fillRect(0, i * 16, 128, 16);
        g.fillStyle = "#8a6238";
        g.fillRect(0, i * 16 + 15, 128, 1);
        g.fillRect(Math.floor(rnd() * 128), i * 16, 1, 16);
      }
    },
    true,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A flat surface from (`x0`, `z0`) to (`x1`, `z1`), its top at `y`; textures repeat every two tiles. */
function surface(
  g: THREE.Group,
  tex: THREE.Texture,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y = 0.03,
): void {
  const t = tex.clone();
  t.repeat.set((x1 - x0) / 2, (z1 - z0) / 2);
  t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), painted(t));
  m.position.set((x0 + x1) / 2, y - 0.03, (z0 + z1) / 2);
  m.receiveShadow = true;
  g.add(m);
}

export interface Tier {
  name: string;
  w: number;
  d: number;
  floors: number;
  roof: string;
  wall: string;
}

export const TIERS: readonly Tier[] = [
  { name: "Shack", w: 2, d: 2, floors: 1, roof: "#8c5c36", wall: "#d49c67" },
  { name: "Cottage", w: 3, d: 2.4, floors: 1, roof: C.roofRed, wall: C.wall },
  { name: "House", w: 3.4, d: 2.6, floors: 2, roof: "#4f8fe0", wall: C.white },
  { name: "Villa", w: 4.6, d: 3, floors: 2, roof: "#3c4454", wall: "#f4efe4" },
  { name: "Mansion", w: 5.4, d: 3.4, floors: 3, roof: "#2f6b66", wall: "#fbf7ef" },
];

/** A gable roof over `w`×`d`, its eaves at `y`. */
function roof(m: Model, w: number, d: number, y: number, color: string): void {
  const rise = d * 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.2, 0);
  shape.lineTo(0, rise);
  shape.lineTo(d / 2 + 0.2, 0);
  shape.lineTo(-d / 2 - 0.2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.3, bevelEnabled: false });
  geo.translate(0, 0, -(w + 0.3) / 2);
  const mesh = new THREE.Mesh(geo, toon(color));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  m.add(mesh);
  // Ridge cap and the gable ends, in the wall colour.
  m.box([w + 0.36, 0.08, 0.14], tint(color, -0.25), [0, y + rise - 0.04, 0], 0.03);
  const gable = new THREE.Shape();
  gable.moveTo(-d / 2, 0);
  gable.lineTo(0, rise - 0.12);
  gable.lineTo(d / 2, 0);
  const end = new THREE.ExtrudeGeometry(gable, { depth: w - 0.02, bevelEnabled: false });
  end.translate(0, 0, -(w - 0.02) / 2);
  const ends = new THREE.Mesh(end, toon(tint(color, 0.55)));
  ends.rotation.y = Math.PI / 2;
  ends.position.y = y;
  m.add(ends);
}

/** A company's house, front towards +z, with the company's name on a sign. */
export function house(tier: Tier, name: string): Model {
  const m = new Model();
  const { w, d, floors } = tier;
  const h = floors * 1.05 + 0.2;
  m.box([w + 0.15, 0.2, d + 0.15], C.stone, [0, 0, 0], 0.02);
  m.box([w, h - 0.2, d], tier.wall, [0, 0.2, 0], 0.02);
  for (let f = 1; f < floors; f++)
    m.box([w + 0.04, 0.06, d + 0.04], tint(tier.wall, -0.12), [0, 0.2 + f * 1.05, 0], 0.01);
  roof(m, w, d, h, tier.roof);

  // Windows on the front and back; the front's ground floor leaves room for the door.
  const cols = Math.max(2, Math.floor(w / 0.85));
  for (const side of [1, -1])
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + (w / cols) * (c + 0.5);
        if (side === 1 && f === 0 && Math.abs(x) < 0.4) continue;
        const face = m.part([0, 0, (side * d) / 2], side === 1 ? 0 : Math.PI);
        const y = 0.55 + f * 1.05;
        face.box([0.44, 0.5, 0.05], C.white, [x, y - 0.04, 0], 0.015);
        const pane = face.box([0.34, 0.38, 0.05], "#a8dcf7", [x, y + 0.02, 0.01], 0.005);
        pane.castShadow = false;
        nightGlow(pane, "#ffd98a");
        face.box([0.03, 0.38, 0.06], C.white, [x, y + 0.02, 0.01]);
        face.box([0.5, 0.05, 0.1], C.white, [x, y - 0.06, 0.03], 0.01);
        if (f === 0) face.box([0.44, 0.08, 0.12], C.leafLight, [x, y - 0.12, 0.07], 0.03);
        for (const s of [-1, 1])
          face.box([0.12, 0.48, 0.03], tint(tier.roof, -0.1), [x + s * 0.3, y - 0.03, 0.02], 0.01);
      }
  m.box([0.48, 0.82, 0.06], C.white, [0, 0.2, d / 2], 0.02);
  m.box([0.4, 0.76, 0.06], tint(tier.roof, -0.1), [0, 0.2, d / 2 + 0.01], 0.015);
  m.ball(0.03, "#e9b73d", [0.13, 0.6, d / 2 + 0.06]);
  m.box([0.7, 0.08, 0.3], C.stoneLight, [0, 0.12, d / 2 + 0.16], 0.02);
  m.box([0.32, 0.4 + d * 0.3, 0.32], "#b0443a", [w / 2 - 0.5, h + 0.1, -0.2], 0.02);
  m.box([0.4, 0.08, 0.4], "#8a3a32", [w / 2 - 0.5, h + 0.5 + d * 0.3, -0.2], 0.02);
  // A porch light by the door.
  nightGlow(m.box([0.08, 0.14, 0.08], "#f4e6c0", [0.38, 0.75, d / 2 + 0.05], 0.02), "#ffe28a");

  const sign = canvasTexture(
    320,
    64,
    (g) => {
      g.fillStyle = "#2b2433";
      g.beginPath();
      g.roundRect(0, 0, 320, 64, 14);
      g.fill();
      g.fillStyle = "#ffe28a";
      g.font = "800 34px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(name, 160, 34);
    },
    true,
  );
  m.box([1.3, 0.26, 0.04], "#2b2433", [0, 1.08, d / 2 + 0.01], 0.01);
  m.plane(1.24, 0.22, glow("#fff", sign), [0, 1.21, d / 2 + 0.035]);
  return m;
}

/** A white picket fence along x, `n` tiles long. */
function fence(n: number): Model {
  const m = new Model();
  for (let i = 0; i <= n * 3; i++) {
    m.box([0.07, 0.42, 0.05], "#fbf7ef", [i / 3 - n / 2, 0, 0], 0.015);
    m.cyl(0.035, 0.06, "#fbf7ef", [i / 3 - n / 2, 0.42, 0], 0.001, 4);
  }
  m.box([n, 0.05, 0.03], "#fbf7ef", [0, 0.12, 0.03]);
  m.box([n, 0.05, 0.03], "#fbf7ef", [0, 0.3, 0.03]);
  return m;
}

/** A low white wall along x, `n` tiles long. */
function wall(n: number): Model {
  const m = new Model();
  m.box([n, 0.5, 0.25], "#eeeae2", [0, 0, 0], 0.02);
  m.box([n + 0.04, 0.06, 0.3], "#ffffff", [0, 0.5, 0], 0.02);
  return m;
}

/** Where people do things in town, for `main.ts` to fill. */
export interface TownSpots {
  /** Paths walked back and forth or round. */
  routes: { points: [number, number][]; loop: boolean }[];
  /** Seats: where, how high, which way they face. */
  seats: { at: [number, number]; y: number; turn: number }[];
  dancers: [number, number][];
  dj: [number, number];
  bartender: [number, number];
  vendor: [number, number];
  customer: [number, number];
  /** Where you start. */
  start: [number, number];
  pond: { at: [number, number]; rx: number; rz: number };
  /** The road's two lanes: z, and which way along x. */
  lanes: { z: number; dir: 1 | -1 }[];
}

export const TOWN_W = 34;
export const TOWN_D = 30;

/** Builds the town. Returns its group and where its people go. */
export function buildTown(): { group: THREE.Group; size: [number, number]; spots: TownSpots } {
  const W = TOWN_W;
  const D = TOWN_D;
  const g = new THREE.Group();
  const grass = lawn();
  grass.repeat.set(W / 2, D / 2);
  const dirt = toon("#7a5638");
  const ground = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, D), [
    dirt,
    dirt,
    painted(grass),
    dirt,
    dirt,
    dirt,
  ]);
  ground.position.set(W / 2, -0.3, D / 2);
  ground.receiveShadow = true;
  g.add(ground);

  const add = (m: Model, x: number, z: number, turn = 0, scale = 1) => {
    m.position.set(x, 0, z);
    m.rotation.y = turn;
    m.scale.setScalar(scale);
    g.add(m);
    return m;
  };
  const seats: TownSpots["seats"] = [];
  /** A bench facing `turn`, and its seat for someone. */
  const benchAt = (x: number, z: number, turn: number, sit = true) => {
    add(parkBench(), x, z, turn);
    if (sit) seats.push({ at: [x + Math.sin(turn) * 0.05, z + Math.cos(turn) * 0.05], y: 0.38, turn });
  };

  // Ground: the square, the walks, the arcade's forecourt, the road and its pavements, the terrace, the park's paths.
  const stone = paving("#a9adb5", "#7d818b", 3);
  const light = paving("#d9d3c6", "#b8b0a0", 5);
  surface(g, stone, 11, 2.5, 25, 11);
  surface(g, stone, 2.5, 11, 32.5, 12.2);
  surface(g, stone, 16.9, 12.2, 19.1, 17.6);
  surface(g, paving("#4a3f86", "#2f285c", 6, "#c9a33a"), 25, 7.2, 32.5, 11, 0.035);
  surface(g, asphalt(), 0, 18.2, W, 20.8);
  surface(g, light, 0, 17.6, W, 18.2, 0.06);
  surface(g, light, 0, 20.8, W, 21.4, 0.06);
  surface(g, deck(), 24, 12.6, 32.5, 17.4, 0.08);
  surface(g, light, 16.9, 21.4, 19.1, 28.5);
  surface(g, light, 2.5, 24.3, 32.5, 25.3);
  for (let x = 0.5; x < W; x += 1.6) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.01, 0.08), toon("#f4efe4"));
    dash.position.set(x, 0.005, 19.5);
    g.add(dash);
  }
  // House paths from door to pavement.
  for (const [x, z0] of [
    [5.8, 16.3],
    [11.7, 16.3],
    [21.5, 16.2],
  ] as const)
    surface(g, light, x - 0.4, z0, x + 0.4, 17.6, 0.04);

  // The square.
  add(grandFountain(), 18, 6.8);
  benchAt(18, 10.2, Math.PI);
  benchAt(13.8, 6.8, Math.PI / 2);
  benchAt(22.2, 6.8, -Math.PI / 2);
  benchAt(18, 3.3, 0, false);
  for (const [x, z] of [
    [11.6, 3.1],
    [24.4, 3.1],
    [11.6, 10.5],
    [24.4, 10.5],
  ] as const)
    add(lanternPillar(), x, z);
  for (const [x, z] of [
    [14.4, 3.9],
    [21.6, 3.9],
    [14.4, 9.7],
    [21.6, 9.7],
  ] as const)
    add(flowerBed(2.2, 1.0, x * 7 + z), x, z);
  for (const x of [13, 23]) add(cypress(), x, 2.9);
  for (const x of [15.6, 20.4]) add(topiary(3), x, 2.9);

  // The arcade and its forecourt.
  add(arcadeBuilding(), 28.7, 4.9);
  for (const [x, z] of [
    [25.6, 7.8],
    [31.8, 7.8],
    [25.6, 10.5],
    [31.8, 10.5],
  ] as const)
    add(palm(x + z), x, z);
  benchAt(28.7, 10.4, Math.PI);

  // Nightshift Labs, the mansion, with a clipped front garden.
  add(house(TIERS[4]!, "Nightshift Labs"), 6.8, 6.2, 0, 1.4);
  add(hedge(7.6, 0.5), 6.8, 10.5);
  for (const x of [4.6, 9.0]) add(topiary(2), x, 9.4);
  add(flowerBed(1.6, 0.8, 41), 3.6, 9.4);
  add(flowerBed(1.6, 0.8, 42), 10.0, 9.4);

  // The houses on the street, each with a fence, a gate and a mailbox.
  const street: [number, number, number, string, string][] = [
    [5.8, 14.6, 2, "Pixel Forge", "#4f8fe0"],
    [11.7, 14.7, 1, "Rubber Duck", "#e25d5d"],
    [21.5, 14.8, 0, "Solo", "#58b36a"],
  ];
  for (const [x, z, tier, name, box] of street) {
    const t = TIERS[tier]!;
    add(house(t, name), x, z, 0, 1.4);
    const half = (t.w * 1.4) / 2 + 0.4;
    add(fence(half - 0.5), x - half / 2 - 0.25, 17.3);
    add(fence(half - 0.5), x + half / 2 + 0.25, 17.3);
    add(mailbox(box), x + 0.8, 17.0);
    add(bush(x * 3), x - half + 0.3, 16.8);
  }
  add(tree("pink", 3), 8.8, 13.2);
  add(tree("yellow", 4), 15.0, 13.4);
  add(tree("orange", 5), 23.5, 13.0, 0, 0.9);

  // The terrace lounge: a bar, a pergola over sofas, and a DJ by the dance floor.
  add(hedge(0.5, 4.6), 24.2, 15);
  add(bar(2.6), 26.6, 13.1);
  for (let i = 0; i < 3; i++) {
    add(stool(["#e8b0a0", "#9fc8b8", "#f4e6c0"][i]), 25.8 + i * 0.8, 13.9);
    if (i) seats.push({ at: [25.8 + i * 0.8, 13.9], y: 0.62, turn: Math.PI });
  }
  add(pergola(3.2, 1.8), 26.6, 16.2);
  add(loungeSofa(2.2), 26.6, 15.9);
  add(lanternTable(), 26.6, 16.9);
  seats.push({ at: [26.1, 15.95], y: 0.42, turn: 0 }, { at: [27.1, 15.95], y: 0.42, turn: 0 });
  add(djBooth(), 30.2, 13.3);
  for (const [x, z] of [
    [24.4, 12.9],
    [32.2, 12.9],
  ] as const)
    add(lanternPillar(), x, z);

  // Along the road.
  for (const x of [3.5, 9.5, 15.5, 21.5, 27.5, 33]) add(streetLamp(), x, 17.75, Math.PI);
  add(hotDogCart(), 13.4, 22.2);
  add(trashBin(), 15.2, 21.7);
  add(trashBin(), 20.0, 17.95);

  // The park: a pond, flower beds and benches round a cross of paths, hedged in.
  add(pond(2.2, 1.2), 7.5, 22.9);
  benchAt(7.5, 21.5 + 0.0, 0);
  benchAt(10.6, 22.9, -Math.PI / 2);
  add(tree("oak", 6, 1.05), 13.2, 23.0);
  for (const z of [22.85, 26.9]) {
    add(hedge(0.5, 2.6), 16.6, z);
    add(hedge(0.5, 2.6), 19.4, z);
  }
  for (const x of [5.5, 11.5, 23.5, 29.5]) {
    add(hedge(4.6, 0.5), x, 24.0);
    add(hedge(4.6, 0.5), x, 25.6);
  }
  for (let i = 0; i < 3; i++) {
    add(flowerBed(3.0, 0.9, 50 + i), 21.6 + i * 3.6, 22.4);
    add(flowerBed(3.0, 0.9, 60 + i, ["#f2a6c8", "#fbf7ef", "#c86bd8", "#ff7ab6"]), 4.4 + i * 3.6, 27.0);
  }
  for (const x of [20.4, 32]) add(cypress(), x, 23.4);
  benchAt(24.6, 23.5, Math.PI);
  benchAt(28.2, 23.5, Math.PI, false);
  add(picnic("#e2443a"), 23.5, 27.4);
  add(picnic("#4f8fe0"), 27.6, 27.2, 0.3);
  add(tree("oak", 7, 0.9), 31.0, 27.0);
  add(tree("pink", 8), 20.6, 27.6);
  for (const x of [15.5, 20.4]) add(topiary(2), x, 21.8);

  // The forest round it all, thicker at the back, behind a low white wall.
  add(wall(W - 2.5), (W + 2.5) / 2, 2.35);
  const back = add(wall(D - 2.5), 2.35, (D + 2.5) / 2, Math.PI / 2);
  back.position.x = 2.35;
  const rnd = seeded(21);
  const kinds: TreeKind[] = ["round", "round", "round", "pine", "oak", "round", "pine"];
  const plant = (x: number, z: number, i: number, size: number) =>
    add(tree(kinds[i % kinds.length]!, i, size), x, z);
  let i = 0;
  for (let x = 0.6; x < W; x += 1.15 + rnd() * 0.4) {
    plant(x, 0.7 + rnd() * 0.4, i++, 1 + rnd() * 0.3);
    if (rnd() < 0.7) plant(x + 0.5, 1.7 + rnd() * 0.3, i++, 0.85 + rnd() * 0.3);
  }
  for (let z = 2.8; z < D - 1; z += 1.15 + rnd() * 0.4) {
    plant(0.7 + rnd() * 0.4, z, i++, 1 + rnd() * 0.3);
    if (rnd() < 0.7) plant(1.75 + rnd() * 0.2, z + 0.5, i++, 0.85 + rnd() * 0.3);
  }
  for (let x = 0.8; x < W; x += 0.9 + rnd() * 0.5) add(bush(x * 11), x, D - 0.5 - rnd() * 0.4);
  for (let z = 2.8; z < D - 1; z += 0.9 + rnd() * 0.5)
    if (z < 17.4 || z > 21.6) add(bush(z * 13), W - 0.5 - rnd() * 0.4, z);
  for (const z of [17.4, 21.6])
    for (let x = 0.8; x < W; x += 2.2)
      add(bush(x * z, "#3f8f3a"), x, z === 17.4 ? 17.2 : 21.8).scale.setScalar(0.7);

  const spots: TownSpots = {
    routes: [
      {
        points: Array.from({ length: 14 }, (_, k) => {
          const a = (k / 14) * Math.PI * 2;
          return [18 + Math.cos(a) * 2.6, 6.8 + Math.sin(a) * 2.6] as [number, number];
        }),
        loop: true,
      },
      {
        points: [
          [3, 17.9],
          [32, 17.9],
        ],
        loop: false,
      },
      {
        points: [
          [31, 21.1],
          [2, 21.1],
        ],
        loop: false,
      },
      {
        points: [
          [18, 12.4],
          [18, 28],
        ],
        loop: false,
      },
      {
        points: [
          [3.5, 11.6],
          [24, 11.6],
        ],
        loop: false,
      },
      {
        points: [
          [4, 24.8],
          [31, 24.8],
        ],
        loop: false,
      },
    ],
    seats,
    dancers: [
      [29.0, 14.8],
      [30.4, 15.5],
      [31.6, 14.7],
      [29.8, 16.6],
    ],
    dj: [30.2, 12.75],
    bartender: [26.6, 12.6],
    vendor: [13.4, 21.65],
    customer: [13.3, 23.1],
    start: [18, 13.5],
    pond: { at: [7.5, 22.9], rx: 1.5, rz: 0.7 },
    lanes: [
      { z: 19.0, dir: 1 },
      { z: 20.0, dir: -1 },
    ],
  };
  return { group: g, size: [W, D], spots };
}
