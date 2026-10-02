import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { computeRowCostUsd, type ModelPrice, PricingCache, roundUsd } from "../src/pricing.ts";

// Helper for hand-computed assertions on aggregated-row costs.
function approxEqualUsd(actual: number, expected: number, tolerance = 1e-4): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

const KNOWN_MODEL = "claude-haiku-4-5-20251001";

describe("the vendored snapshot", () => {
  test("has a known model, normalized into ModelPrice", () => {
    const entry = new PricingCache().lookup(KNOWN_MODEL)!;
    expect(entry.input).toBeGreaterThan(0);
    expect(entry.output).toBeGreaterThan(0);
    expect(typeof entry.cacheCreation).toBe("number");
    expect(typeof entry.cacheRead).toBe("number");
    expect(entry.reasoning === null || typeof entry.reasoning === "number").toBe(true);
  });

  test("filters out the sample_spec entry", () => {
    expect(new PricingCache().lookup("sample_spec")).toBeNull();
  });
});

describe("computeRowCostUsd", () => {
  test("returns float USD without rounding", () => {
    const price: ModelPrice = {
      input: 0.000003,
      output: 0.000015,
      cacheCreation: 0,
      cacheRead: 0,
      reasoning: null,
    };
    const row = {
      input: 100,
      output: 50,
      cacheCreation: 0,
      cacheRead: 0,
      reasoning: 0,
    };
    // 100 * 0.000003 + 50 * 0.000015 = 0.0003 + 0.00075 = 0.00105
    expect(computeRowCostUsd(row, price)).toBeCloseTo(0.00105, 10);
  });

  test("reasoning field on row is IGNORED in cost calculation", () => {
    // Defends against accidental re-introduction of a reasoning charge.
    // ccusage doesn't add one; we don't either.
    const price: ModelPrice = {
      input: 0,
      output: 0,
      cacheCreation: 0,
      cacheRead: 0,
      reasoning: 0.0001,
    };
    const row = {
      input: 0,
      output: 0,
      cacheCreation: 0,
      cacheRead: 0,
      reasoning: 1_000_000, // 1M reasoning tokens — would be $100 if billed
    };
    expect(computeRowCostUsd(row, price)).toBe(0);
  });

  test("Claude Opus 4.7: hand-computed full-bucket scenario matches within $0.0001", () => {
    // Real Opus 4.7 prices from src/server/pricing-fallback.json:
    //   input_cost_per_token              = 5e-6   ($5 / 1M)
    //   output_cost_per_token             = 2.5e-5 ($25 / 1M)
    //   cache_creation_input_token_cost   = 6.25e-6 ($6.25 / 1M, 5m TTL)
    //   cache_read_input_token_cost       = 5e-7   ($0.50 / 1M)
    const cache = new PricingCache();
    const price = cache.lookup("claude-opus-4-7")!;
    expect(price).not.toBeNull();
    expect(price.input).toBe(5e-6);
    expect(price.output).toBe(2.5e-5);
    expect(price.cacheCreation).toBe(6.25e-6);
    expect(price.cacheRead).toBe(5e-7);

    const row = {
      input: 1_000,
      output: 500,
      cacheCreation: 200,
      cacheRead: 8_000,
      reasoning: 0,
    };
    // By hand:
    //   1000   * 5e-6    = 0.005
    //    500   * 2.5e-5  = 0.0125
    //    200   * 6.25e-6 = 0.00125
    //   8000   * 5e-7    = 0.004
    //   total           = 0.02275 USD
    const expected = 0.005 + 0.0125 + 0.00125 + 0.004;
    const actual = computeRowCostUsd(row, price);
    approxEqualUsd(actual, expected);
    approxEqualUsd(actual, 0.02275);
  });

  test("Codex gpt-5.5: hand-computed scenario with non-cached input + cached + output", () => {
    // Real gpt-5.5 prices from src/server/pricing-fallback.json:
    //   input_cost_per_token              = 5e-6   ($5 / 1M)
    //   cache_read_input_token_cost       = 5e-7   ($0.50 / 1M)
    //   output_cost_per_token             = 3e-5   ($30 / 1M)
    //   (no cache_creation for OpenAI — Codex parser sets it to 0)
    //
    // The Codex parser emits a raw token_count of
    //   input=10000, cached=8000, output=2000, reasoning=500
    // is emitted as:
    //   inputTokens=2000 (non-cached), cacheReadTokens=8000,
    //   outputTokens=2000, reasoningTokens=500
    // and the cost formula is:
    //   2000 * 5e-6  = 0.01
    //   8000 * 5e-7  = 0.004
    //   2000 * 3e-5  = 0.06
    //   reasoning is informational only — NOT added.
    const cache = new PricingCache();
    const price = cache.lookup("gpt-5.5")!;
    expect(price).not.toBeNull();
    expect(price.input).toBe(5e-6);
    expect(price.cacheRead).toBe(5e-7);
    expect(price.output).toBe(3e-5);

    const row = {
      input: 2_000, // non-cached portion (parser already subtracted)
      output: 2_000,
      cacheCreation: 0,
      cacheRead: 8_000,
      reasoning: 500, // ignored by formula
    };
    const expected = 0.01 + 0.004 + 0.06;
    const actual = computeRowCostUsd(row, price);
    approxEqualUsd(actual, expected);
    approxEqualUsd(actual, 0.074);
  });

  test("aggregate-zero row yields zero cost", () => {
    const cache = new PricingCache();
    const price = cache.lookup("claude-opus-4-7")!;
    const row = {
      input: 0,
      output: 0,
      cacheCreation: 0,
      cacheRead: 0,
      reasoning: 0,
    };
    expect(computeRowCostUsd(row, price)).toBe(0);
  });

  test("unknown model: lookup returns null", () => {
    expect(new PricingCache().lookup("totally-made-up-2099")).toBeNull();
  });
});

describe("roundUsd", () => {
  test("rounds to 4 decimal places", () => {
    expect(roundUsd(0.12345)).toBe(0.1235);
    expect(roundUsd(0.12344)).toBe(0.1234);
    expect(roundUsd(10.935)).toBe(10.935);
    expect(roundUsd(0)).toBe(0);
  });
});

describe("PricingCache.lookup", () => {
  let cache: PricingCache;

  beforeEach(() => {
    cache = new PricingCache();
  });

  test("exact match returns price", () => {
    const p = cache.lookup(KNOWN_MODEL);
    expect(p).not.toBeNull();
    expect(p!.input).toBeGreaterThan(0);
  });

  test("case-insensitive match", () => {
    const lower = cache.lookup("claude-opus-4-7");
    const upper = cache.lookup("Claude-Opus-4-7");
    const mixed = cache.lookup("CLAUDE-OPUS-4-7");
    expect(lower).not.toBeNull();
    expect(upper).toEqual(lower!);
    expect(mixed).toEqual(lower!);
  });

  test("strips anthropic/ prefix", () => {
    const direct = cache.lookup("claude-opus-4-7");
    const prefixed = cache.lookup("anthropic/claude-opus-4-7");
    expect(prefixed).not.toBeNull();
    expect(prefixed).toEqual(direct!);
  });

  test("strips openai/ prefix", () => {
    const direct = cache.lookup("gpt-5.5");
    if (direct) {
      const prefixed = cache.lookup("openai/gpt-5.5");
      expect(prefixed).toEqual(direct);
    }
  });

  test("effort variants use their priced base model, including thinking and provider prefixes", () => {
    for (const [variant, base] of [
      ["gpt-5.5-high", "gpt-5.5"],
      ["gpt-5.4-medium", "gpt-5.4"],
      ["gpt-5.6-sol-xhigh", "gpt-5.6-sol"],
      ["gpt-5.6-luna-high", "gpt-5.6-luna"],
      ["gpt-5.6-terra-medium", "gpt-5.6-terra"],
      ["claude-opus-5-thinking-high", "claude-opus-5"],
      ["anthropic/claude-opus-4-8-thinking-xhigh", "claude-opus-4-8"],
      ["vercel_ai_gateway/openai/gpt-5.5-high", "gpt-5.5"],
    ]) {
      expect(cache.lookup(base!)).not.toBeNull();
      expect(cache.lookup(variant!)).toEqual(cache.lookup(base!));
    }
  });

  test("normalization preserves separately priced variants and fast or max tiers", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        Response.json({
          "grok-example": { input_cost_per_token: 1, output_cost_per_token: 2 },
          "grok-example-fast": { input_cost_per_token: 3, output_cost_per_token: 4 },
          "grok-example-high": { input_cost_per_token: 5, output_cost_per_token: 6 },
        })) as unknown as typeof fetch;
      await cache.refreshFromUpstream();
      expect(cache.lookup("grok-example-high")!.input).toBe(5);
      expect(cache.lookup("grok-example-medium-fast")!.input).toBe(3);
      expect(cache.lookup("grok-example-max")).toBeNull();
      expect(cache.lookup("grok-example-thinking-max")).toBeNull();
      expect(cache.lookup("missing-medium-fast")).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  test("unknown model returns null", () => {
    expect(cache.lookup("totally-fake-model-xyz")).toBeNull();
  });

  test("real target models from local data are all resolvable", () => {
    const targets = [
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-5",
      "claude-sonnet-4-6",
      "gpt-5.5",
      "gpt-5.3-codex",
      "gpt-5-codex",
    ];
    const missing: string[] = [];
    for (const t of targets) {
      if (cache.lookup(t) === null) missing.push(t);
    }
    expect(missing).toEqual([]);
  });
});

describe("PricingCache.refreshFromUpstream", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("falls back gracefully when fetch fails", async () => {
    let attempted = false;
    globalThis.fetch = (async () => {
      attempted = true;
      throw new Error("simulated network failure");
    }) as unknown as typeof fetch;

    const cache = new PricingCache();
    const baselinePrice = cache.lookup(KNOWN_MODEL);
    expect(baselinePrice).not.toBeNull();

    const result = await cache.refreshFromUpstream();
    expect(attempted).toBe(true);
    expect(result.failed).toBe(true);
    // Existing data stays usable.
    expect(cache.lookup(KNOWN_MODEL)).toEqual(baselinePrice!);
  });

  test("falls back gracefully when fetch returns non-OK", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;

    const cache = new PricingCache();
    const result = await cache.refreshFromUpstream();
    expect(result.failed).toBe(true);
  });

  test("swaps map when fetch succeeds with valid JSON", async () => {
    let urlSeen = "";
    globalThis.fetch = (async (url: string) => {
      urlSeen = url;
      return new Response(
        JSON.stringify({
          "fake-test-model-9000": {
            input_cost_per_token: 1,
            output_cost_per_token: 2,
            cache_creation_input_token_cost: 0.5,
            cache_read_input_token_cost: 0.1,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const cache = new PricingCache();
    const result = await cache.refreshFromUpstream();
    expect(result.failed).toBe(false);
    expect(result.updated).toBe(1);
    expect(urlSeen).toContain("BerriAI/litellm");
    const p = cache.lookup("fake-test-model-9000");
    expect(p).toEqual({
      input: 1,
      output: 2,
      cacheCreation: 0.5,
      cacheRead: 0.1,
      reasoning: null,
    });
    // Old entry is gone.
    expect(cache.lookup(KNOWN_MODEL)).toBeNull();
  });

  test("keeps old map if upstream returns empty", async () => {
    globalThis.fetch = (async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const cache = new PricingCache();
    const result = await cache.refreshFromUpstream();
    expect(result.failed).toBe(true);
    expect(cache.lookup(KNOWN_MODEL)).not.toBeNull();
  });
});

describe("price aliases for models LiteLLM does not publish", () => {
  test("codex-auto-review prices as gpt-5-codex instead of silently $0", () => {
    const cache = new PricingCache();
    const target = cache.lookup("gpt-5-codex");
    expect(target).not.toBeNull();
    expect(cache.lookup("codex-auto-review")).toEqual(target);
  });

  test("an alias never shadows a real upstream price", () => {
    // gpt-5-codex is published; the alias machinery must not overwrite it.
    expect(new PricingCache().lookup("gpt-5-codex")!.input).toBeGreaterThan(0);
  });
});
