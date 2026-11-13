import { expect, jest, test } from "bun:test";
import { type TokenmaxxingState, tokenmaxxing } from "@tokenmaxxing/core/games/tokenmaxxing.ts";
import type { Frame } from "@tokenmaxxing/core/games/wire.ts";
import { KEPT_TABLE, Kept } from "../src/actors/kept.ts";
import { match } from "../src/actors/match.ts";
import { connOf } from "./fake-actor.ts";
import { memorySql } from "./memory-sql.ts";

const actions = match.config.actions!;
type Context = Parameters<typeof actions.usage>[0];

/** A battle under way, kept in a database as the actor keeps it; `writes()` counts the times it wrote there. */
async function battle() {
  const now = Date.now();
  const players = Array.from({ length: 12 }, (_, i) => i + 1);
  const game = tokenmaxxing.setup(players, 0, { minutes: 15 }, now - 120_000);
  game.phase = "live";
  for (const id of players) game.history[id] = Array.from({ length: 120 }, (_, i) => [game.startsAt + i, i]);
  let tokens = 0;
  let statusUpdates = 0;
  let used = async () => ({ tokens, flagged: false });
  const frames: Frame[] = [];
  const state = {
    id: 8,
    game: "tokenmaxxing" as const,
    players: players.map((userId) => ({ userId, name: `p${userId}` })),
    stake: 10,
    split: "all" as const,
    options: { minutes: 15 },
    seed: 0,
    startedAt: now - 120_000,
    betsCloseAt: game.startsAt,
    state: game,
    outcome: null,
    seen: {},
    bets: {},
    forfeited: [] as number[],
    reported: false,
  };
  const { sql } = memorySql();
  await sql.execute(KEPT_TABLE);
  await Kept.create(sql, state);
  let writes = 0;
  const kept = await Kept.load<typeof state>({
    execute: sql.execute,
    transaction: (fn) => {
      writes++;
      return sql.transaction(fn);
    },
  });
  const client = {
    player: { get: () => ({ tokensBetween: () => used() }) },
    world: {
      getOrCreate: () => ({
        callout: async () => {},
        gameStatus: async () => {
          statusUpdates++;
        },
      }),
    },
    arcade: { getOrCreate: () => ({ finished: async () => {}, moved: async () => {} }) },
    town: { getOrCreate: () => ({}) },
  };
  const controller = new AbortController();
  const inside = connOf({ kind: "internal" });
  const vars = {
    state: kept.value,
    kept,
    callers: new Map<string, object>([...inside.callers, ["player", { kind: "user", userId: 1 }]]),
    loop: null as Promise<void> | null,
    chat: { take: () => true },
  };
  const ctx = {
    vars,
    conn: inside.conn,
    conns: new Map([["player", { send: (_event: string, frame: Frame) => frames.push(frame) }]]),
    abortSignal: controller.signal,
    keepAwake: <T>(p: Promise<T>) => p,
    client: () => client,
  } as unknown as Context;
  return {
    ctx,
    vars,
    state: kept.value,
    /** The context as player 1 calls with it. */
    asPlayer: { ...ctx, conn: { id: "player" } } as unknown as Context,
    controller,
    frames,
    writes: () => writes,
    statusUpdates: () => statusUpdates,
    score: (n: number) => {
      tokens = n;
    },
    query: (fn: typeof used) => {
      used = fn;
    },
  };
}

test("repeated battle score updates keep the frames and standings right, and each is saved once", async () => {
  const b = await battle();
  for (let i = 1; i <= 150; i++) {
    b.score(i * 1_000);
    expect(await actions.usage(b.ctx, 1)).toMatchObject({ tokens: i * 1_000, place: 1, players: 12 });
    expect(b.state.state.tokens[1]).toBe(i * 1_000);
    expect(b.state.state.history[1]!.length).toBeLessThanOrEqual(120);
    expect(await actions.standing(b.ctx, 1)).toMatchObject({ tokens: i * 1_000, place: 1 });
  }
  expect(b.statusUpdates()).toBe(150);
  expect(b.frames).toHaveLength(150);
  expect((b.frames.at(-1)!.view as TokenmaxxingState).tokens[1]).toBe(150_000);
  expect(b.state.state.tokens[2]).toBe(0);
  // One write for each score; reading the standing wrote nothing.
  expect(b.writes()).toBe(150);
});

test("unchanged usage and ticks do not rewrite or broadcast a match", async () => {
  const b = await battle();
  expect(await actions.usage(b.ctx, 1)).toMatchObject({ tokens: 0 });
  expect(b.writes()).toBe(0);
  expect(b.statusUpdates()).toBe(0);
  expect(b.frames).toEqual([]);
  // A tick on fake timers, instead of waiting out its second: it's over once the loop waits for the next.
  jest.useFakeTimers();
  match.config.onWake!(b.ctx as never);
  try {
    jest.advanceTimersToNextTimer();
    for (let i = 0; jest.getTimerCount() === 0 && i < 1_000; i++) await Promise.resolve();
    if (jest.getTimerCount() === 0) throw new Error("the tick didn't finish");
    expect(b.writes()).toBe(0);
    expect(b.statusUpdates()).toBe(0);
    expect(b.frames).toEqual([]);
  } finally {
    b.controller.abort();
    jest.useRealTimers();
    await b.vars.loop;
  }
});

test("a usage query finishing after a forfeit does not restore that player's score", async () => {
  const b = await battle();
  const pending = Promise.withResolvers<{ tokens: number; flagged: boolean }>();
  b.query(() => pending.promise);
  const usage = actions.usage(b.ctx, 1);
  await actions.forfeit(b.asPlayer);
  pending.resolve({ tokens: 99_000, flagged: false });
  expect(await usage).toMatchObject({ tokens: 0, place: null });
  expect(b.state.state.forfeited).toContain(1);
  expect(b.state.state.tokens[1]).toBe(0);
});

test("the match's chat keeps each line with the next id, and is saved with the match", async () => {
  const b = await battle();
  for (let i = 1; i <= 50; i++) await actions.say(b.asPlayer, `line ${i}`);
  const chat = (b.state as { chat?: unknown[] }).chat!;
  expect(chat).toHaveLength(50);
  expect(chat.at(-1)).toMatchObject({ id: 50, userId: 1, name: "p1", text: "line 50" });
  expect(b.writes()).toBe(50);
});
