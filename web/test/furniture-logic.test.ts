import { expect, test } from "bun:test";
import { MAPS } from "@tokenmaxxing/core/maps.ts";
import { COMPANY_FURNITURE, canHang, withPieces } from "@tokenmaxxing/core/office.ts";
import type { Drop } from "@tokenmaxxing/core/world.ts";
import { ghostFits, UNDO_DEPTH, UndoStack } from "../src/game/furniture-logic.ts";

const base = MAPS.hq;
const floor: [number, number][] = [];
for (let y = base.y0; y < base.y0 + base.height; y++)
  for (let x = base.x0; x < base.x0 + base.width; x++)
    if (base.walkable(x, y) && !base.kind(x, y).portal) floor.push([x, y]);
const bonsai = COMPANY_FURNITURE.find((f) => f.name === "Bonsai")!;
const drop = (id: number, x: number, y: number, ch = bonsai.ch): Drop => ({
  id,
  item: `furn.${ch}`,
  room: "hq:1",
  x,
  y,
  by: 1,
  at: 0,
});
const world = (drops: Drop[], people: { x: number; y: number }[] = []) => ({
  drops,
  map: withPieces(
    drops.map((d) => ({ ch: d.item.slice(5), x: d.x, y: d.y })),
    base,
  ),
  base,
  people,
});

test("a ghost is green on bare floor, red on a wall, a piece, a person or off the map", () => {
  const [x, y] = floor[0]!;
  const w = world([]);
  expect(ghostFits(w, `furn.${bonsai.ch}`, null, { x, y })).toBe(true);
  expect(ghostFits(w, `furn.${bonsai.ch}`, null, { x: 0, y: 0 })).toBe(false);
  expect(ghostFits(w, `furn.${bonsai.ch}`, null, { x: 999, y: 999 })).toBe(false);
  expect(ghostFits(world([], [{ x, y }]), `furn.${bonsai.ch}`, null, { x, y })).toBe(false);
  expect(ghostFits(world([drop(1, x, y)]), `furn.${bonsai.ch}`, null, { x, y })).toBe(false);
  // Not furniture: no ghost to show.
  expect(ghostFits(w, "hat.1", null, { x, y })).toBe(false);
});

test("a piece being moved fits on its own tile, and its own tile is free for it, but nothing else's", () => {
  const [x, y] = floor[0]!;
  const [x2, y2] = floor.find(([fx, fy]) => fx !== x || fy !== y)!;
  const mine = drop(1, x, y);
  const other = drop(2, x2, y2);
  const w = world([mine, other]);
  expect(ghostFits(w, mine.item, mine, { x, y })).toBe(true);
  expect(ghostFits(w, mine.item, mine, { x: x2, y: y2 })).toBe(false);
  // A new piece (not moving) cannot go where one stands.
  expect(ghostFits(w, mine.item, null, { x, y })).toBe(false);
});

test("a wide piece needs all its tiles", () => {
  const wide = COMPANY_FURNITURE.find((f) => (f.w ?? 1) > 1 && !f.wall);
  if (!wide) return;
  const free = floor.find(([x, y]) =>
    Array.from({ length: wide.w! }, (_, i) => base.walkable(x + i, y)).every(Boolean),
  )!;
  expect(ghostFits(world([]), `furn.${wide.ch}`, null, { x: free[0], y: free[1] })).toBe(true);
  // Its second tile taken by a bonsai.
  const w = world([drop(3, free[0] + 1, free[1])]);
  expect(ghostFits(w, `furn.${wide.ch}`, null, { x: free[0], y: free[1] })).toBe(false);
});

test("the undo stack keeps the last ten steps, newest first out", () => {
  const s = new UndoStack();
  expect(s.pop()).toBeUndefined();
  for (let i = 0; i < UNDO_DEPTH + 3; i++) s.push({ kind: "move", room: "hq:1", id: i, x: 0, y: 0 });
  expect(s.size).toBe(UNDO_DEPTH);
  expect(s.peek()).toMatchObject({ id: UNDO_DEPTH + 2 });
  expect(s.pop()).toMatchObject({ id: UNDO_DEPTH + 2 });
  const ids: number[] = [];
  for (let step = s.pop(); step; step = s.pop()) ids.push(step.id);
  expect(ids).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

test("a piece put down again is a new row: the steps naming the old one follow it", () => {
  const s = new UndoStack();
  s.push({ kind: "place", room: "hq:1", id: 5, item: "furn.ρ" });
  s.push({ kind: "move", room: "hq:1", id: 6, x: 1, y: 1 });
  s.push({ kind: "move", room: "hq:1", id: 5, x: 2, y: 2 });
  s.remap(5, 9);
  expect(s.pop()).toMatchObject({ id: 9, x: 2 });
  expect(s.pop()).toMatchObject({ id: 6 });
  expect(s.pop()).toMatchObject({ id: 9, kind: "place" });
  s.push({ kind: "move", room: "hq:1", id: 1, x: 0, y: 0 });
  s.clear();
  expect(s.peek()).toBeUndefined();
});

test("a poster hangs only where the wall has room for it", () => {
  const poster = COMPANY_FURNITURE.find((f) => f.wall)!;
  const w = poster.w ?? 1;
  const spots: [number, number][] = [];
  for (let y = base.y0; y < base.y0 + base.height; y++)
    for (let x = base.x0; x < base.x0 + base.width; x++)
      if (canHang(base, x, y, w, false)) spots.push([x, y]);
  expect(spots.length).toBeGreaterThan(0);
  const [x, y] = spots[0]!;
  expect(ghostFits(world([]), `furn.${poster.ch}`, null, { x, y })).toBe(true);
  expect(ghostFits(world([drop(4, x, y, poster.ch)]), `furn.${poster.ch}`, null, { x, y })).toBe(false);
  // Floor is not wall.
  const [fx, fy] = floor[0]!;
  expect(ghostFits(world([]), `furn.${poster.ch}`, null, { x: fx, y: fy })).toBe(false);
});
