import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { type PokerState, SEATS } from "@tokenmaxxing/core/poker.ts";
import { pokerChairs, pokerTable } from "@tokenmaxxing/core/pokertable.ts";
import * as THREE from "three";
import { installHeadlessGlobals } from "../src/render3d/perf/stubs.ts";
import { sceneOf } from "../src/render3d/rooms/poker-events.ts";

installHeadlessGlobals();

/** The room's own picture is the map's less its walls: x by 1, y by 2 (`INSET`). */
const INSET = [1, 2] as const;

const state = (over: Partial<PokerState> = {}): PokerState => ({
  v: 1,
  seats: [
    {
      userId: 7,
      stack: 190,
      bet: 10,
      folded: false,
      allIn: false,
      inHand: true,
      cards: true,
      last: "bet 10",
      leaving: false,
      ready: true,
    },
    null,
    {
      userId: 8,
      stack: 150,
      bet: 0,
      folded: true,
      allIn: false,
      inHand: true,
      cards: false,
      last: "fold",
      leaving: false,
      ready: true,
    },
    null,
    null,
    null,
  ],
  button: 0,
  street: "flop",
  board: [1, 2, 3],
  pot: 60,
  bet: 10,
  raise: 10,
  toAct: 2,
  legal: null,
  turnMs: 5000,
  nextMs: 0,
  result: null,
  names: { 7: "ada", 8: "bo" },
  ...over,
});

test("the felt shows the board, the pot out of the bets' sight, and each seat's cards, bet and button", () => {
  const scene = sceneOf(state());
  expect(scene.board).toEqual([1, 2, 3]);
  expect(scene.pot).toBe(50);
  expect(scene.seats[0]).toMatchObject({ stack: 190, bet: 10, dealt: true, dealer: true, shown: null });
  // A folded player's cards are gone; empty seats stay empty.
  expect(scene.seats[2]).toMatchObject({ dealt: false, dealer: false });
  expect(scene.seats[1]).toBeNull();
  expect(sceneOf(null)).toEqual({ board: [], pot: 0, seats: [] });
});

test("after a showdown the shown hands lie face up, and nothing is shown for a fold-out", () => {
  const over = {
    street: null,
    pot: 0,
    result: {
      hand: 3,
      board: [1, 2, 3, 4, 5],
      pots: [],
      shown: [{ userId: 7, hole: [10, 11] as [number, number], name: "Pair" }],
      won: { 7: 40 },
    },
  } as Partial<PokerState>;
  const scene = sceneOf(state(over));
  expect(scene.board).toEqual([1, 2, 3, 4, 5]);
  expect(scene.seats[0]!.shown).toEqual([10, 11]);
  expect(scene.seats[2]!.shown).toBeNull();
  expect(sceneOf(state({ ...over, result: { ...over.result!, shown: [] } })).seats[0]!.shown).toBeNull();
});

test("the 3D table is as big as the map's, and lays cards and chips on its felt", async () => {
  const { pokerTable3d } = await import("../src/render3d/rooms/poker3d.ts");
  const spot = pokerTable(MAPS.inn)!;
  const model = pokerTable3d();
  const box = new THREE.Box3().setFromObject(model);
  expect(box.max.x - box.min.x).toBeLessThanOrEqual(spot.w + 1e-3);
  expect(box.max.z - box.min.z).toBeLessThanOrEqual(spot.h + 1e-3);
  expect(box.max.x - box.min.x).toBeGreaterThan(spot.w - 0.5);
  const bare = model.children.length;
  const live = model.children.find((c) => c.userData.live)!;
  expect(live.children).toHaveLength(0);
  model.show(sceneOf(state()));
  // The board, a pair of backs, a button and chips.
  expect(live.children.length).toBeGreaterThan(8);
  expect(model.children).toHaveLength(bare);
  // The same scene changes nothing; an empty one clears the felt.
  const before = live.children.length;
  model.show(sceneOf(state()));
  expect(live.children).toHaveLength(before);
  model.show(sceneOf(null));
  expect(live.children).toHaveLength(0);
});

test("the Tavern room has the table and a seat at every chair of the map, at the map's tiles", async () => {
  const { buildTavernRoom } = await import("../src/render3d/rooms/tavern3d.ts");
  const inn = buildTavernRoom();
  expect(inn.poker).not.toBeNull();
  const chairs = pokerChairs(MAPS.inn);
  expect(chairs).toHaveLength(SEATS);
  const seats = inn.room.placed.filter((p) => p.asset.id === "tavern:poker-chair");
  expect(seats.map((p) => `${p.x},${p.z}`).sort()).toEqual(
    chairs.map((ch) => `${ch.x - INSET[0]},${ch.y - INSET[1]}`).sort(),
  );
  for (const p of seats) expect(inn.room.seatOf(p)).not.toBeNull();
  // The layout the demo writes back to the map has the same tiles.
  const spot = pokerTable(MAPS.inn)!;
  expect(inn.layout.get(`${spot.x - INSET[0]},${spot.y - INSET[1]}`)).toBe("♠");
  for (const ch of chairs) expect(inn.layout.get(`${ch.x - INSET[0]},${ch.y - INSET[1]}`)).toBe("♣");
  // Labels find each seat in the world, six different places round the table.
  const at = new Set(chairs.map((_, i) => inn.poker!.seatWorld(i, new THREE.Vector3()).toArray().join()));
  expect(at.size).toBe(SEATS);
});

test("the idle table names its blinds from the rules, not from a number typed into the label", async () => {
  const { tableText } = await import("../src/render3d/rooms/poker-events.ts");
  const { BIG_BLIND, SMALL_BLIND } = await import("@tokenmaxxing/core/poker.ts");
  expect(tableText(state({ street: null, result: null }))).toBe(`🃏 Poker · ${SMALL_BLIND}/${BIG_BLIND}`);
});
