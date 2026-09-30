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
