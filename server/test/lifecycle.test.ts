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
