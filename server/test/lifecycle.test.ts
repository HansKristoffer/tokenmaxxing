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
