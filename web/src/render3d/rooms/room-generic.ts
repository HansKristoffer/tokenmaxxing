import { type GameMap, LEGEND, type SeatKind } from "@tokenmaxxing/core/maps.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { batchStatic } from "../engine/batch.ts";
import { disposeObject } from "../engine/dispose.ts";
import { canvasTexture, Model, seeded, tint, toon } from "../kit/kit.ts";
import { ExitMarkers } from "./exit-markers.ts";
import { exitDoorway } from "./exits3d.ts";
import { floorSlab } from "./room.ts";
import { type RoomCtx, type RoomView, registerFallbackRoom, SEAT_Y } from "./rooms.ts";
import { wallEase } from "./walls.ts";
import { groundTileOf, hash } from "./world.ts";

/**
 * Any core map, drawn from its legend: a floor painted tile by tile, walls that drop out of the way of the camera,
 * and every other tile as a simple block with its name on it. So every room is walkable and legible before it has a
 * picture of its own.
 */

const WALL_H = 2.6;
/** Pixels per tile on the floor canvas. */
const PX = 12;

const GROUND: Record<string, [string, string]> = {
  ".": ["#6fb35a", "#66a852"],
  ",": ["#d7c49a", "#cdb98e"],
  ":": ["#ece2cc", "#dfd3b8"],
  '"': ["#6fb35a", "#66a852"],
  _: [C.floor, C.floorDark],
  "=": ["#b4524a", "#a24841"],
  Δ: ["#7a4f8f", "#6c447f"],
  q: ["#6b6f80", "#60647a"],
  e: ["#8c5c36", "#7e5230"],
  "~": ["#4aa3dd", "#5bb2e8"],
};

/** Tiles that are the floor itself: nothing stands on them. */
const FLAT = new Set(Object.keys(GROUND));

/** How tall a block is, by what the legend calls it. */
function heightOf(name: string, seat: string | undefined, portal: boolean): number {
  if (portal) return 2.1;
  if (seat === "bed") return 0.26;
  if (seat) return 0.3;

  // Tall pieces by name: storage, machines, screens and windows.
  if (/shelf|case|rack|fridge|plant wall|machine|cabinet|terminal|board|window|screen|aquarium/.test(name)) {
    return 1.7;
  }
  // Plants, statues and lamps.
  if (/tree|statue|lamp|monstera|bonsai|gong|globe|chandelier/.test(name)) return 1.4;
  // Pieces at table height: desks, counters, bars, seats and the TV.
  if (/desk|table|counter|bar|rug|bench|stool|stage|chalk|coffee|barrel|taps?|tap$|tv/.test(name)) {
    return 0.85;
  }
  return 0.9;
}

/** Where a block's name goes: the offset from its middle and the turn that faces the plane outward. */
const SIDES: readonly [number, number, number][] = [
  [0, 1, 0],
  [0, -1, Math.PI],
  [1, 0, Math.PI / 2],
  [-1, 0, -Math.PI / 2],
];

export function buildGenericRoom(id: string, ctx: RoomCtx): RoomView {
  const map: GameMap = ctx.map;
  const W = map.width;
  const D = map.height;
  const base = groundTileOf(id);
  const group = new THREE.Group();
  const toWorld = (tx: number, ty: number): [number, number] => [tx - map.x0 + 0.5, ty - map.y0 + 0.5];
  const toTile = (x: number, z: number): [number, number] => [Math.floor(x) + map.x0, Math.floor(z) + map.y0];
  const glyphAt = (x: number, y: number) => map.at(x + map.x0, y + map.y0);

  // The floor: one canvas, a square per tile, under everything.
  const rnd = seeded(hash(id));
  const tex = canvasTexture(W * PX, D * PX, (g) => {
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        const glyph = glyphAt(x, y);
        const [oddTile, evenTile] = GROUND[FLAT.has(glyph) ? glyph : base] ?? GROUND._!;
        g.fillStyle = (x + y) % 2 ? oddTile : evenTile;
        g.fillRect(x * PX, y * PX, PX, PX);

        if (glyph === "_" || glyph === "e") {
          g.fillStyle = C.floorLine;
          g.globalAlpha = 0.4;
          g.fillRect(x * PX, y * PX + 4, PX, 1);
          g.globalAlpha = 1;
        } else if (glyph === "." || glyph === '"') {
          g.fillStyle = "#86c76d";
          for (let i = 0; i < 4; i++) {
            g.fillRect(x * PX + Math.floor(rnd() * 10), y * PX + Math.floor(rnd() * 10), 1, 1);
          }
        } else if (glyph === "~") {
          g.fillStyle = "#8fd3f5";
          g.fillRect(x * PX + 2 + ((x + y) % 4), y * PX + 5, 4, 1);
        }
      }
    }
  });
  group.add(floorSlab(W, D, tex, tint(base === "." ? "#6fb35a" : C.floor, -0.4)));

  // Walls, grouped by the edge they are in so the ones in front of the camera can drop.
  const normals = {
    n: new THREE.Vector3(0, 0, 1),
    s: new THREE.Vector3(0, 0, -1),
    w: new THREE.Vector3(1, 0, 0),
    e: new THREE.Vector3(-1, 0, 0),
    none: new THREE.Vector3(),
  };
  const walls = Object.entries(normals).map(([edge, normal]) => ({ edge, normal, model: new Model() }));
  for (const wall of walls) group.add(wall.model);
  const wallOf = (edge: string) => walls.find((w) => w.edge === edge)!.model;
  const edgeOf = (x: number, y: number): keyof typeof normals => {
    if (id === "town") return "none";
    if (y <= 1) return "n";
    if (y === D - 1) return "s";
    if (x === 0) return "w";
    if (x === W - 1) return "e";
    return "none";
  };

  // Signs on the blocks: the legend's name, once per name.
  const labels = new Map<string, THREE.CanvasTexture>();
  const label = (name: string, colour: string) => {
    let texture = labels.get(name);
    if (!texture) {
      texture = canvasTexture(
        128,
        48,
        (g) => {
          g.fillStyle = tint(colour, -0.35);
          g.fillRect(0, 0, 128, 48);
          g.fillStyle = "#fbf7ef";
          g.font = "bold 17px ui-monospace, Menlo, monospace";
          g.textAlign = "center";
          g.textBaseline = "middle";

          // A long name of several words wraps onto two lines, the last word on its own.
          const words = name.split(" ");
          const wraps = words.length > 1 && name.length > 9;
          const lines = wraps ? [words.slice(0, -1).join(" "), words.at(-1)!] : [name];
          for (const [i, line] of lines.entries()) {
            g.fillText(line.slice(0, 11), 64, 24 + (i - (lines.length - 1) / 2) * 20);
          }
        },
        true,
      );
      labels.set(name, texture);
    }
    return texture;
  };
  const faces = new Map<string, THREE.MeshBasicMaterial>();
  const faceOf = (name: string, colour: string) => {
    let material = faces.get(name);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ map: label(name, colour) });
      faces.set(name, material);
    }
    return material;
  };

  const boxes = new Map<number, THREE.BoxGeometry>();
  const boxGeometry = (h: number) => {
    let geometry = boxes.get(h);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(0.88, h, 0.88);
      geometry.translate(0, h / 2, 0);
      boxes.set(h, geometry);
    }
    return geometry;
  };

  const plane = new THREE.PlaneGeometry(0.7, 0.26);
  const solid = new Model();
  group.add(solid);
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < W; x++) {
      const glyph = glyphAt(x, y);
      if (FLAT.has(glyph)) continue;

      const kind = LEGEND[glyph];
      if (glyph === "W") {
        const wall = wallOf(edgeOf(x, y));
        const tx = x + 0.5;
        const tz = y + 0.5;
        const wallColour = y <= 1 ? C.wall : tint(C.wall, -0.03);
        wall.box([1, WALL_H, 1], wallColour, [tx, 0, tz], 0).castShadow = true;
        wall.box([1.02, 0.1, 1.02], C.wallTop, [tx, WALL_H, tz], 0.01);
        wall.box([1.01, 0.12, 1.01], C.woodDark, [tx, 0, tz], 0.01);
        continue;
      }

      // A tile the legend does not name has nothing to draw.
      if (!kind) continue;
      // Walk-through tiles with no ground colour of their own (the stage, a chandelier): leave the floor.
      if (kind.walk) continue;

      const edge = edgeOf(x, y);
      if (kind.portal) {
        // A way out: a doorway facing the room, never lowered with the wall it is in.
        const door = exitDoorway({ block: edge !== "none", outside: id !== "town" });
        door.position.set(x + 0.5, 0, y + 0.5);
        door.rotation.y = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2, none: 0 }[edge];
        solid.add(door);
        continue;
      }

      const h = heightOf(kind.name, kind.seat, false);
      const hue = (hash(glyph) % 360) / 360;
      const colour = `#${new THREE.Color().setHSL(hue, kind.seat ? 0.35 : 0.45, 0.55).getHexString()}`;
      const front = faceOf(kind.name, colour);
      const box = new THREE.Mesh(boxGeometry(h), toon(tint(colour, 0.1)));
      box.position.set(x + 0.5, 0, y + 0.5);
      box.castShadow = box.receiveShadow = true;
      solid.add(box);

      // The name on every side, so it reads from whichever way the view is turned.
      for (const [dx, dz, turn] of SIDES) {
        const sign = new THREE.Mesh(plane, front);
        sign.position.set(x + 0.5 + dx * 0.442, h * 0.55, y + 0.5 + dz * 0.442);
        sign.rotation.y = turn;
        solid.add(sign);
      }
    }
  }

  // Each wall group moves as one (it drops out of the camera's way), so what is inside it can be merged now.
  group.updateMatrixWorld(true);
  for (const piece of [...walls.map((w) => w.model), solid]) {
    batchStatic(piece, { chunk: 1e9, samples: 1, probe: () => {} });
  }

  const markers = new ExitMarkers(map, toWorld);
  group.add(markers.group);

  const bounds = { minX: 0, maxX: W, minZ: 0, maxZ: D, height: WALL_H };
  return {
    id,
    group,
    outdoors: id === "town",
    bounds,
    view: Math.max(7, Math.min(10.5, Math.max(W * 0.5, D * 0.75))),
    toWorld,
    toTile,
    seatY: (_x, _y, kind) => SEAT_Y[kind as SeatKind] ?? 0.33,
    tick(_t, _dt, toward) {
      const ease = wallEase.k;
      for (const w of walls) {
        if (w.edge === "none") continue;
        const front = w.normal.dot(toward) < -0.01;
        const target = front ? 0.06 : 1;
        w.model.scale.y += (target - w.model.scale.y) * ease;
        w.model.visible = w.model.scale.y > 0.02;
      }
    },
    frame: (f) => markers.update(f.me, f.t),
    signs: () => [],
    dispose() {
      markers.dispose();
      group.removeFromParent();
      disposeObject(group);
      for (const texture of labels.values()) texture.dispose();
    },
  };
}

registerFallbackRoom(buildGenericRoom);
