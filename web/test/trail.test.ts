import { expect, test } from "bun:test";
import { RUN_STEP_MS } from "@tokenmaxxing/core/world.ts";
import { type Left, leave, ownStep, TRAIL_MS } from "../src/game/trail.ts";

/** A run to the right from (10, 5), a tile every `RUN_STEP_MS`; the server's word for each tile arrives `delay` ms late. */
function run(delay: number, steps = 30) {
  const trail: Left[] = [];
  const me = { x: 10, y: 5 };
  const echoes: { x: number; due: number }[] = [];
  let pulledBack = 0;
  for (let i = 0; i < steps; i++) {
    const now = i * RUN_STEP_MS;
    for (const e of echoes.splice(0, echoes.findLastIndex((e) => e.due <= now) + 1))
      if (!ownStep(trail, me, e.x, 5, now)) pulledBack++;
    leave(trail, me.x, me.y, now);
    me.x++;
    echoes.push({ x: me.x, due: now + delay });
  }
  return pulledBack;
}

test("a runner far from the server is never pulled back to a tile they already ran past", () => {
  // Next door, the tile coming back is the one underfoot, or the one before it.
  expect(run(60)).toBe(0);
  // Across an ocean it is two or three tiles behind: only the trail knows those were ours.
  expect(run(300)).toBe(0);
  expect(run(700)).toBe(0);
});

test("the server moving us somewhere we haven't just been is its word", () => {
  const trail: Left[] = [];
  const me = { x: 10, y: 5 };
  for (let i = 0; i < 5; i++) leave(trail, me.x++, me.y, i * RUN_STEP_MS);
  const now = 5 * RUN_STEP_MS;
  // Sent to bed across the room.
  expect(ownStep(trail, me, 3, 12, now)).toBe(false);
  // Two tiles back on the path we ran: ours.
  expect(ownStep(trail, me, me.x - 2, 5, now)).toBe(true);
  // The same tile long after we passed it: the server put us back there.
  expect(ownStep(trail, me, me.x - 4, 5, now + TRAIL_MS + 1_000)).toBe(false);
});

test("the trail forgets: it holds a couple of seconds of steps, however long the walk", () => {
  const trail: Left[] = [];
  for (let i = 0; i < 1_000; i++) leave(trail, i, 0, i * RUN_STEP_MS);
  expect(trail.length).toBeLessThanOrEqual(Math.ceil(TRAIL_MS / RUN_STEP_MS) + 2);
});
