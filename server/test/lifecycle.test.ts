import { expect, test } from "bun:test";
import { RivetError } from "rivetkit";
import type { Client } from "rivetkit/client";
import type { registry } from "../src/actors/registry.ts";
import { authenticate, waitForTick } from "../src/actors/shared.ts";

test("shutdown cancels a pending tick before it can touch actor state", async () => {
  const controller = new AbortController();
  const tick = waitForTick(controller.signal, 60_000);
  controller.abort();
  expect(await tick).toBe(false);
  expect(await waitForTick(controller.signal, 60_000)).toBe(false);
  expect(await waitForTick(new AbortController().signal, 1)).toBe(true);
});

test("a credential-verification outage does not become an invalid token", async () => {
  const failure = new Error("callback_timed_out");
  const cache = new Map();
  const client = {
    player: {
      get: () => ({
        verify: async () => {
          throw failure;
        },
      }),
    },
  } as unknown as Client<typeof registry>;
  await expect(authenticate({ token: `1.${"a".repeat(43)}` }, client, cache)).rejects.toBe(failure);
  expect(cache.size).toBe(0);
});

test("a deleted player still rejects its token without retrying an outage", async () => {
  const client = {
    player: {
      get: () => ({
        verify: async () => {
          throw new RivetError("actor", "not_found", "deleted");
        },
      }),
    },
  } as unknown as Client<typeof registry>;
  await expect(authenticate({ token: `1.${"a".repeat(43)}` }, client, new Map())).rejects.toMatchObject({
    code: "unauthorized",
  });
});

test("a busy player keeps a recently checked token working, but not a revoked one", async () => {
  const token = `1.${"a".repeat(43)}`;
  let verify: () => Promise<unknown> = async () => "device";
  const client = { player: { get: () => ({ verify: () => verify() }) } } as unknown as Client<
    typeof registry
  >;
  const cache = new Map();
  await authenticate({ token }, client, cache);
  cache.get(token).until = Date.now() - 1; // the minute is up

  verify = () => new Promise(() => {}); // restarting: never answers
  const started = Date.now();
  expect(await authenticate({ token }, client, cache)).toMatchObject({ kind: "user", via: "device" });
  expect(Date.now() - started).toBeLessThan(5_000);

  verify = async () => {
    throw new Error("callback_timed_out");
  };
  expect(await authenticate({ token }, client, cache)).toMatchObject({ via: "device" });

  verify = async () => null; // revoked
  await expect(authenticate({ token }, client, cache)).rejects.toMatchObject({ code: "unauthorized" });

  cache.get(token).until = Date.now() - 11 * 60_000; // checked too long ago: an outage fails the call
  verify = async () => {
    throw new Error("callback_timed_out");
  };
  await expect(authenticate({ token }, client, cache)).rejects.toThrow("callback_timed_out");
});

test("a match saved as over but never finished still pays out when it wakes", async () => {
  const { match } = await import("../src/actors/match.ts");
  const { tokenmaxxing } = await import("@tokenmaxxing/core/games/tokenmaxxing.ts");
  const now = Date.now();
  // Past its grace period, 2 players, tokens in: over. The restart came before `finish`.
  const game = { ...tokenmaxxing.setup([1, 2], 0, { minutes: 15 }, now - 3_600_000), phase: "over" };
  game.tokens = { 1: 500, 2: 100 };
  const finished: unknown[] = [];
  const client = {
    arcade: {
      getOrCreate: () => ({ finished: async (_id: number, outcome: unknown) => finished.push(outcome) }),
    },
    world: { getOrCreate: () => ({ gameStatus: async () => {}, callout: async () => {} }) },
    town: { getOrCreate: () => ({}) },
  } as unknown as Client<typeof registry>;
  const state = {
    id: 5,
    game: "tokenmaxxing",
    players: [
      { userId: 1, name: "a" },
      { userId: 2, name: "b" },
    ],
    state: game,
    outcome: null,
    reported: false,
    seen: {},
    forfeited: [],
  };
  const ctx = {
    state,
    conns: new Map(),
    abortSignal: new AbortController().signal,
    client: () => client,
    keepAwake: <T>(p: Promise<T>) => p,
  };
  await (match.config.run as unknown as (c: typeof ctx) => Promise<void>)(ctx);
  expect(finished).toEqual([{ places: [[1], [2]] }]);
  expect(state.reported).toBe(true);
});

/** The arcade over `matches` (as `startMatch` saves them), recording what `town` and `world` are asked. */
async function arcadeWith(matches: Record<string, object>) {
  const { arcade } = await import("../src/actors/arcade.ts");
  const { serial } = await import("../src/actors/shared.ts");
  const calls: string[] = [];
  const client = {
    town: { getOrCreate: () => ({ refund: async (ref: string) => calls.push(`refund ${ref}`) }) },
    world: {
      getOrCreate: () => ({
        release: async (id: number) => calls.push(`release ${id}`),
        notify: async () => {},
      }),
    },
    arcade: { getOrCreate: () => ({}) },
  } as unknown as Client<typeof registry>;
  const controller = new AbortController();
  const ctx = {
    state: { nextId: 10, tables: {}, matches, names: {} },
    vars: { serial: serial() },
    conn: { state: { kind: "internal" } },
    conns: new Map(),
    abortSignal: controller.signal,
    client: () => client,
    keepAwake: <T>(p: Promise<T>) => p,
  };
  const actions = arcade.config.actions as unknown as Record<
    string,
    (c: typeof ctx, ...args: unknown[]) => unknown
  >;
  return {
    calls,
    act: (name: string, ...args: unknown[]) => actions[name]!(ctx, ...args),
    /** One sweep. */
    sweep: async () => {
      const running = (arcade.config.run as unknown as (c: typeof ctx) => Promise<void>)(ctx);
      await Bun.sleep(1_100);
      controller.abort();
      await running;
      return calls;
    },
  };
}

const live = (id: number, game: string, startedAgo: number, movedAgo?: number) => ({
  id,
  game,
  players: [1, 2],
  stake: 10,
  split: "all",
  options: {},
  startedAt: Date.now() - startedAgo,
  betsCloseAt: 0,
  bets: [],
  outcome: null as unknown,
  endedAt: null,
  rematch: [],
  movedAt: movedAgo === undefined ? undefined : Date.now() - movedAgo,
});

test("a held game whose match stopped moving on is called off after 3 minutes: refunded, players let go", async () => {
  const stuck = live(1, "spr", 5 * 60_000, 3 * 60_000 + 1_000);
  const arcade = await arcadeWith({ 1: stuck });
  expect(await arcade.sweep()).toEqual(["refund table:1", "refund bets:1", "release 1"]);
  expect(stuck.outcome).toEqual({ void: "Ship, Pivot, Raise got stuck and was called off." });
  expect(stuck).toMatchObject({ released: true });
});

test("slow games aren't called off: a Due Diligence turn running out, a battle, a match that just moved on", async () => {
  // Nobody claims: a 4 s reveal and a 30 s turn go by before the turn runs out and it moves on.
  const dice = live(1, "dice", 10 * 60_000, 34_000);
  const battle = live(2, "tokenmaxxing", 60 * 60_000); // not held: only the 25-hour limit
  const spr = live(3, "spr", 4 * 60_000); // quiet since it started, but it moves on now
  const arcade = await arcadeWith({ 1: dice, 2: battle, 3: spr });
  arcade.act("moved", 3);
  expect(await arcade.sweep()).toEqual([]);
  for (const m of [dice, battle, spr]) expect(m.outcome).toBeNull();
});

test("a match the arcade lost in a restart still gives the coins back and lets its players go", async () => {
  const arcade = await arcadeWith({});
  await arcade.act("finished", 7, { places: [[1], [2]] });
  expect(arcade.calls).toEqual(["refund table:7", "refund bets:7", "release 7"]);
});
