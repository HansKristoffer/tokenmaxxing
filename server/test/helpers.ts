import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import { buildApp } from "../src/app.ts";
import { openDb } from "../src/db/db.ts";
import { PricingCache } from "../src/pricing.ts";

export const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);
export const MIN = 60_000;
export const HOUR = 3_600_000;

let seq = 0;
export function event(overrides: Partial<TokenEvent> = {}): TokenEvent {
  seq++;
  return {
    source: "claude_code",
    sessionId: "s1",
    agentId: null,
    messageId: `m${seq}`,
    requestId: null,
    timestamp: NOW - HOUR,
    model: "claude-haiku-4-5-20251001",
    messageType: "assistant",
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    reasoningTokens: null,
    ...overrides,
  };
}

/** One assistant event every 5 minutes from `start` for `durationMs`. */
export function activity(
  sessionId: string,
  start: number,
  durationMs: number,
  agentId: string | null = null,
) {
  const out: TokenEvent[] = [];
  for (let t = start; t < start + durationMs; t += 5 * MIN)
    out.push(event({ sessionId, agentId, timestamp: t }));
  return out;
}

export function testApp() {
  const db = openDb(":memory:");
  const app = buildApp({
    db,
    pricing: new PricingCache(),
    version: "test",
    now: () => NOW,
    secureCookies: false,
  });

  const req = async (
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; ip?: string } = {},
  ) => {
    const headers: Record<string, string> = { "x-real-ip": opts.ip ?? "1.1.1.1" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(path, {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    // biome-ignore lint/suspicious/noExplicitAny: test convenience
    return { status: res.status, body: (await res.json().catch(() => null)) as any, res };
  };

  const signUp = async (name: string) => {
    const r = await req("POST", "/api/users", { body: { name }, ip: `10.0.0.${seq++ % 250}` });
    if (r.status !== 201) throw new Error(`signup ${name}: ${r.status}`);
    return r.body.token as string;
  };

  const ingest = (token: string, events: TokenEvent[]) =>
    req("POST", "/api/ingest", { token, body: { events } });

  const names = async (token: string, query = "") =>
    ((await req("GET", `/api/leaderboard?range=7d${query}`, { token })).body.entries as { name: string }[])
      .map((e) => e.name)
      .sort();

  return { db, app, req, signUp, ingest, names };
}
