import { expect, test } from "bun:test";
import { type Launch, OPENROUTER_MODELS } from "@tokenmaxxing/core/launch.ts";
import { checkLaunches } from "../src/launch.ts";

const now = Date.UTC(2026, 9, 27, 6, 0);
const list = {
  data: [
    {
      id: "openai/gpt-6.1-terra",
      name: "OpenAI: GPT-6.1 Terra",
      created: (now - 3_600_000) / 1000,
      description: "Terra. Mid-tier.",
      pricing: { prompt: "0.000001", completion: "0.000005", input_cache_read: "0.00000005" },
    },
  ],
};
/** A fetch that answers OpenRouter's list with `reply`, or fails. */
const answer = (reply: unknown, ok = true) =>
  (async (url: string) => {
    if (url !== OPENROUTER_MODELS) throw new Error(`unexpected ${url}`);
    if (reply instanceof Error) throw reply;
    return { ok, json: async () => reply };
  }) as unknown as typeof fetch;
const prev: Launch[] = [
  {
    provider: "kimi",
    model: "K3",
    id: "",
    price: { input: null, output: null, cache: null },
    tagline: "Hi.",
    at: 1,
  },
];

test("reads OpenRouter's list into launches", async () => {
  expect(await checkLaunches([], now, answer(list), {})).toEqual([
    {
      provider: "codex",
      model: "GPT-6.1 Terra",
      id: "openai/gpt-6.1-terra",
      price: { input: 1, output: 5, cache: 0.05 },
      tagline: "Terra.",
      at: now - 3_600_000,
    },
  ]);
});

test("a failed read keeps what we had", async () => {
  expect(await checkLaunches(prev, now, answer(new Error("offline")), {})).toBe(prev);
  expect(await checkLaunches(prev, now, answer(list, false), {})).toBe(prev);
  expect(await checkLaunches(prev, now, answer({ error: "rate limited" }), {})).toBe(prev);
});

test("LAUNCH_FEED=off takes every stand down", async () => {
  expect(await checkLaunches(prev, now, answer(list), { LAUNCH_FEED: "off" })).toEqual([]);
});
