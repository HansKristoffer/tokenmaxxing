/**
 * The net cafe's poker table as a 3D prop: a stadium of green felt in a padded rail and a wooden rim, on two
 * pedestals. Its size and the way round it are read off the map (`core/pokertable.ts`), so the chairs and the chips
 * always meet. `show()` lays what is going on onto the felt: the board as little face-up cards, each seat's cards,
 * bet and stack as chips, the pot and the dealer's button. Nothing here knows the game's rules.
 */
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type Card, cardFace } from "@tokenmaxxing/core/poker.ts";
import { pokerChairs, pokerTable } from "@tokenmaxxing/core/pokertable.ts";
import { DIRS } from "@tokenmaxxing/core/world.ts";
import * as THREE from "three";
import { C } from "../../art/palette.ts";
import { canvasTexture, liveModel, Model, tint, type V3 } from "../kit/kit.ts";

const FELT = "#256b43";
const FELT_Y = 0.8;
const FONT = "ui-monospace, Menlo, Consolas, monospace";

/** What the felt shows: the board, the pot out of sight of the bets, and each seat (null: empty). */
export interface PokerScene {
  board: Card[];
  /** Coins in the middle: the pot without the bets still in front of the players. */
  pot: number;
  seats: (PokerSeatScene | null)[];
}

export interface PokerSeatScene {
  stack: number;
  /** Put in on this street. */
  bet: number;
  /** Holds two cards still in the hand: shown face down. */
  dealt: boolean;
  /** Their two cards, face up (showdown). */
  shown: Card[] | null;
  dealer: boolean;
}

export interface PokerModel extends Model {
  show(scene: PokerScene): void;
  /** Where seat `i` is in the world (the chair), for labels. */
  seatWorld(i: number, into: THREE.Vector3): THREE.Vector3;
  /** The middle of the felt in the world. */
  centreWorld(into: THREE.Vector3): THREE.Vector3;
}

let cardGeom: THREE.PlaneGeometry | null = null;
/** One card-sized plane for every card on every table. */
function cardGeometry(): THREE.PlaneGeometry {
  cardGeom ??= new THREE.PlaneGeometry(0.3, 0.42);
  cardGeom.userData.shared = true;
  return cardGeom;
}

const faces = new Map<Card | "back" | "button", THREE.MeshBasicMaterial>();

/** A card's face (or its back, or the dealer's button) as a flat, unlit picture. Made once, shared by every table. */
function faceMaterial(which: Card | "back" | "button"): THREE.MeshBasicMaterial {
  let material = faces.get(which);
  if (material) return material;

  const button = which === "button";
  const map = canvasTexture(
    60,
    button ? 60 : 84,
    (g) => {
      if (button) {
        g.fillStyle = "#fbf7ef";
        g.beginPath();
        g.arc(30, 30, 28, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.ink;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = C.ink;
        g.font = `bold 34px ${FONT}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("D", 30, 32);
        return;
      }

      g.fillStyle = which === "back" ? "#7a2a3a" : "#fbf7ef";
      g.beginPath();
      g.roundRect(1, 1, 58, 82, 7);
      g.fill();
      g.strokeStyle = which === "back" ? "#f1e6d2" : C.ink;
      g.lineWidth = 3;
      g.stroke();

      if (which === "back") {
        g.strokeStyle = "#5e1f2d";
        g.lineWidth = 3;
        for (let i = -90; i < 90; i += 11) {
          g.beginPath();
          g.moveTo(i, 4);
          g.lineTo(i + 80, 80);
          g.stroke();
        }
        return;
      }

      const { rank, suit, red } = cardFace(which);
      g.fillStyle = red ? "#c0392b" : C.ink;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${rank.length > 1 ? 26 : 32}px ${FONT}`;
      g.fillText(rank, 30, 22);
      g.font = `bold 44px ${FONT}`;
      g.fillText(suit, 30, 60);
    },
    true,
  );
  map.userData.shared = true;

  material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  material.userData.shared = true;
  faces.set(which, material);
  return material;
}

/** A card or the button, lying on the felt at `at` with its top edge towards `towards` (an xz direction). */
function lay(
  parent: THREE.Object3D,
  which: Card | "back" | "button",
  at: V3,
  towards: [number, number],
): void {
  const card = new THREE.Mesh(cardGeometry(), faceMaterial(which));
  if (which === "button") {
    // The button is a round picture on a 0.15 square, lifted 0.012 above the felt.
    card.scale.set(0.5, 0.36, 1);
    card.position.set(at[0], at[1] + 0.012, at[2]);
  } else {
    card.position.set(...at);
  }

  card.rotation.order = "YXZ";
  card.rotation.x = -Math.PI / 2;
  card.rotation.y = Math.atan2(-towards[0], -towards[1]);
  parent.add(card);
}

const CHIP_COLOURS = { bet: "#c0392b", stack: "#2f6fb5", pot: "#e0a82e" } as const;

/** Chips for `coins` at `at` on the felt: stacks of up to eight, a chip for every ten coins. */
function chips(
  model: Model,
  coins: number,
  at: V3,
  kind: keyof typeof CHIP_COLOURS,
  across: [number, number],
): void {
  if (coins <= 0) return;

  const count = Math.min(24, Math.max(1, Math.round(coins / 10)));
  const colour = CHIP_COLOURS[kind];
  const stacks = Math.ceil(count / 8);
  for (let s = 0; s < stacks; s++) {
    const inStack = Math.min(8, count - s * 8);
    const offset = s - (stacks - 1) / 2;
    const x = at[0] + across[0] * offset * 0.17;
    const z = at[2] + across[1] * offset * 0.17;
    for (let i = 0; i < inStack; i++) {
      const shade = i % 2 === 0 ? colour : tint(colour, 0.25);
      model.cyl(0.07, 0.026, shade, [x, at[1] + i * 0.028, z], 0.07, 10);
    }
  }
}

/** The poker table, built from the map's table and chairs; `show` puts the game on it. */
export function pokerTable3d(): PokerModel {
  const table = new Model() as PokerModel;
  const spot = pokerTable(MAPS.basement) ?? { x: 0, y: 0, w: 4, h: 2 };
  const chairs = pokerChairs(MAPS.basement);
  const hw = spot.w / 2;
  const hd = spot.h / 2;

  // A stadium: a box between two discs.
  const radius = hd - 0.03;
  const halfSpan = hw - radius;
  const stadium = (discRadius: number, y: number, h: number, paint: string, shrink = 0) => {
    const reach = discRadius - shrink;
    table.box([halfSpan * 2, h, reach * 2], paint, [0, y, 0], 0.02);
    for (const s of [-1, 1]) table.cyl(reach, h, paint, [s * halfSpan, y, 0], reach, 28);
  };
  stadium(radius - 0.03, 0.46, 0.14, C.woodDark);
  stadium(radius, 0.6, 0.15, C.woodLight);
  stadium(radius - 0.07, 0.75, 0.04, "#5e2a2a");
  stadium(radius - 0.2, 0.78, 0.022, FELT);

  for (const s of [-1, 1]) {
    table.cyl(0.2, 0.46, C.woodDark, [s * halfSpan, 0, 0], 0.15, 12);
    table.cyl(0.32, 0.05, C.woodDark, [s * halfSpan, 0, 0], 0.3, 14);
  }
  table.box([halfSpan * 2, 0.07, 0.12], C.woodDark, [0, 0.12, 0], 0.02);

  // Where each seat sits, in the table's own space (a tile is a unit), and which way it faces.
  const cx = spot.x + hw;
  const cy = spot.y + hd;
  const seats = chairs.map((chair) => {
    const [fx, fz] = DIRS[chair.facing];
    return { x: chair.x + 0.5 - cx, z: chair.y + 0.5 - cy, f: [fx, fz] as [number, number] };
  });

  // What is on the felt changes with every hand, so it is a live model: the room neither merges it into its
  // static meshes nor puts the table's subtree to sleep (`perf/bake.ts`).
  const live = liveModel();
  live.position.y = FELT_Y + 0.012;
  table.add(live);

  let shownKey = "";
  table.show = (scene) => {
    const key = JSON.stringify(scene);
    if (key === shownKey) return;
    shownKey = key;

    live.clear();
    for (const [i, card] of scene.board.entries()) {
      lay(live, card, [(i - (scene.board.length - 1) / 2) * 0.37, 0, 0], [0, -1]);
    }
    chips(live, scene.pot, [0, 0, -0.5], "pot", [1, 0]);

    for (const [i, seat] of scene.seats.entries()) {
      const chair = seats[i];
      if (!seat || !chair) continue;

      const vertical = chair.f[0] === 0;
      const pointAt = (dist: number, side = 0): V3 => [
        chair.x + chair.f[0] * dist - chair.f[1] * side,
        0,
        chair.z + chair.f[1] * dist + chair.f[0] * side,
      ];
      // Two cards side by side, tops towards the middle of the table; the dealer's button beside them.
      const cardDist = vertical ? 0.9 : 1.0;
      const across: [number, number] = [-chair.f[1], chair.f[0]];

      if (seat.shown || seat.dealt) {
        for (const [cardIndex, side] of [-0.17, 0.17].entries()) {
          lay(live, seat.shown?.[cardIndex] ?? "back", pointAt(cardDist, side), chair.f);
        }
      }
      if (seat.dealer) lay(live, "button", pointAt(cardDist, -0.52), chair.f);

      chips(live, seat.bet, pointAt(vertical ? 1.18 : 1.3), "bet", across);
      chips(live, seat.stack, pointAt(cardDist, 0.55), "stack", across);
    }
  };

  const scratch = new THREE.Vector3();
  table.seatWorld = (i, into) => {
    const seat = seats[i];
    scratch.set(seat?.x ?? 0, 0, seat?.z ?? 0);
    return into.copy(table.localToWorld(scratch));
  };
  table.centreWorld = (into) => into.copy(table.localToWorld(scratch.set(0, FELT_Y, 0)));
  return table;
}

/** A chair at the poker table: a wooden chair facing +z, with a red cushion. */
export function pokerChair(): Model {
  const model = new Model();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) model.cyl(0.025, 0.4, C.woodDark, [sx * 0.17, 0, sz * 0.17], 0.025, 8);
  }
  model.box([0.42, 0.06, 0.42], C.woodLight, [0, 0.4, 0], 0.02);
  for (const sx of [-1, 1]) model.box([0.04, 0.5, 0.04], C.woodDark, [sx * 0.17, 0.44, -0.18], 0.012);
  for (const y of [0.62, 0.76]) model.box([0.372, 0.07, 0.03], C.wood, [0, y, -0.18], 0.01);
  model.box([0.38, 0.05, 0.38], C.rug, [0, 0.455, 0.01], 0.02);
  return model;
}
