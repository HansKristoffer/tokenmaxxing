import { describe, expect, test } from "bun:test";
import { activity, event, HOUR, MIN, NOW, testApp } from "./helpers.ts";

async function statsFor(events: ReturnType<typeof activity>) {
  const { signUp, ingest, req } = testApp();
  const token = await signUp("alice");
  expect((await ingest(token, events)).status).toBe(200);
  return (await req("GET", "/api/leaderboard?range=7d", { token })).body.entries[0];
}

const start = NOW - 10 * HOUR;

describe("parallelism", () => {
  test("one agent → 1.0×", async () => {
    const s = await statsFor(activity("a", start, 2 * HOUR));
    expect(s.parallelism).toBe(1);
    expect(s.peakAgents).toBe(1);
    expect(s.activeHours).toBe(2);
  });

  test("3 fully overlapping sessions → 3.0×", async () => {
    const s = await statsFor([
      ...activity("a", start, HOUR),
      ...activity("b", start, HOUR),
      ...activity("c", start, HOUR),
    ]);
    expect(s.parallelism).toBe(3);
    expect(s.peakAgents).toBe(3);
  });

  test("2 sessions back to back → 1.0×", async () => {
    const s = await statsFor([...activity("a", start, HOUR), ...activity("b", start + HOUR, HOUR)]);
    expect(s.parallelism).toBe(1);
  });

  test("2 sessions for 1h, then 1 for 1h → 1.5×", async () => {
    const s = await statsFor([...activity("a", start, 2 * HOUR), ...activity("b", start, HOUR)]);
    expect(s.parallelism).toBe(1.5);
    expect(s.peakAgents).toBe(2);
  });

  test("a subagent counts separately from its parent", async () => {
    const s = await statsFor([...activity("a", start, HOUR), ...activity("a", start, HOUR, "sub1")]);
    expect(s.parallelism).toBe(2);
  });

  test("under 1 active hour → no parallelism ranking", async () => {
    const s = await statsFor([...activity("a", start, 30 * MIN), ...activity("b", start, 30 * MIN)]);
    expect(s.parallelism).toBeNull();
    expect(s.peakAgents).toBe(2);
  });

  test("user prompts don't count as agent activity", async () => {
    const s = await statsFor([
      ...activity("a", start, HOUR),
      ...activity("b", start, HOUR).map((e) => ({ ...e, messageType: "user" as const, model: "" })),
    ]);
    expect(s.parallelism).toBe(1);
    expect(s.prompts).toBe(12);
  });
});

describe("leaderboard", () => {
  test("totals, cost, tokens per active hour and sorting", async () => {
    const { req, signUp, ingest } = testApp();
    const alice = await signUp("alice");
    const bob = await signUp("bob");
    const g = (await req("POST", "/api/groups", { token: alice, body: { name: "G" } })).body;
    await req("POST", "/api/groups/join", { token: bob, body: { code: g.code } });
    // alice: more tokens, one agent. bob: fewer tokens, two agents in parallel.
    await ingest(
      alice,
      activity("a", start, HOUR).map((e) => ({ ...e, outputTokens: 10_000 })),
    );
    await ingest(bob, [...activity("x", start, HOUR), ...activity("y", start, HOUR)]);

    const byTokens = (await req("GET", "/api/leaderboard?range=7d", { token: alice })).body.entries;
    expect(byTokens.map((e: { name: string }) => e.name)).toEqual(["alice", "bob"]);
    expect(byTokens[0]).toMatchObject({
      rank: 1,
      turns: 12,
      tokens: 12 * 10_100,
      tokensPerActiveHour: 12 * 10_100,
    });
    expect(byTokens[0].costUsd).toBeGreaterThan(0);

    const byPar = (await req("GET", "/api/leaderboard?range=7d&sort=parallelism", { token: alice })).body
      .entries;
    expect(byPar.map((e: { name: string }) => e.name)).toEqual(["bob", "alice"]);
  });

  test("range excludes old events; today follows the viewer's timezone", async () => {
    const { req, signUp, ingest } = testApp();
    const alice = await signUp("alice");
    await ingest(alice, [event({ timestamp: NOW - 10 * 86_400_000 }), event({ timestamp: NOW - 11 * HOUR })]);
    const tokens = async (q: string) =>
      (await req("GET", `/api/leaderboard?${q}`, { token: alice })).body.entries[0].tokens;
    expect(await tokens("range=7d")).toBe(150);
    expect(await tokens("range=all")).toBe(300);
    // NOW is 12:00 UTC; 01:00 UTC is "today" in UTC but "yesterday" at UTC-2 (tz=+120)
    expect(await tokens("range=today&tz=0")).toBe(150);
    expect(await tokens("range=today&tz=120")).toBe(0);
  });

  test("user detail: models and daily buckets", async () => {
    const { req, signUp, ingest } = testApp();
    const alice = await signUp("alice");
    await ingest(alice, [
      event({ timestamp: NOW - HOUR }),
      event({ timestamp: NOW - 25 * HOUR, model: "gpt-5-codex", source: "codex" }),
    ]);
    const d = (await req("GET", "/api/users/alice?range=7d", { token: alice })).body;
    expect(d.models.map((m: { model: string }) => m.model).sort()).toEqual([
      "claude-haiku-4-5-20251001",
      "gpt-5-codex",
    ]);
    expect(d.daily.map((x: { date: string }) => x.date)).toEqual(["2026-09-22", "2026-09-23"]);
    expect(d.totals.tokens).toBe(300);
  });
});
