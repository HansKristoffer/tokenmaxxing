import { describe, expect, test } from "bun:test";
import { activity, as, client, event, HOUR, MIN, signUp } from "./rivet.ts";

/** Three days ago, on a 5-minute boundary: inside "7d", and no bucket straddles a world midnight. */
const start = Math.floor((Date.now() - 3 * 24 * HOUR) / (5 * MIN)) * 5 * MIN;

async function statsFor(events: ReturnType<typeof activity>) {
  const u = await signUp("stats");
  await as(u.token).player(u.userId).ingest(events);
  return (await u.town.profile(u.userId, "7d")).totals;
}

describe("ingest", () => {
  test("re-sent events are dropped", async () => {
    const u = await signUp("dedup");
    const events = [event(), event(), event({ messageType: "user", model: "" })];
    const player = as(u.token).player(u.userId);
    expect(await player.ingest(events)).toEqual({ inserted: 3, duplicates: 0, skipped: 0 });
    expect(await player.ingest(events)).toEqual({ inserted: 0, duplicates: 3, skipped: 0 });
  });

  test("invalid events are skipped, not stored", async () => {
    const u = await signUp("skip");
    const r = await as(u.token)
      .player(u.userId)
      .ingest([event(), { nope: true }, event({ inputTokens: -1 })]);
    expect(r).toEqual({ inserted: 1, duplicates: 0, skipped: 2 });
  });

  test("only the device token can ingest, and only into its own player", async () => {
    const a = await signUp("own");
    const b = await signUp("other");
    await expect(as(b.token).player(a.userId).ingest([event()])).rejects.toThrow();
    const code = await as(a.token).player(a.userId).mintLoginCode();
    const session = await client.player.get([String(a.userId)]).redeemLoginCode(code);
    await expect(as(session).player(a.userId).ingest([event()])).rejects.toThrow();
  });
});

describe("login codes", () => {
  test("a code works once and becomes a session that other actors accept", async () => {
    const u = await signUp("code");
    const code = await as(u.token).player(u.userId).mintLoginCode();
    const anon = client.player.get([String(u.userId)]);
    const session = await anon.redeemLoginCode(code);
    await expect(anon.redeemLoginCode(code)).rejects.toThrow();
    expect((await as(session).town.me()).name).toBe(u.name);
  });

  test("a bad token is rejected; signing out revokes everything", async () => {
    const u = await signUp("revoke");
    await expect(as(`${u.userId}.${"x".repeat(43)}`).town.me()).rejects.toThrow();
    const code = await as(u.token).player(u.userId).mintLoginCode();
    await as(u.token).town.me(); // warms town's token cache: sign-out must still win
    await as(u.token).player(u.userId).signOut();
    await expect(as(u.token).town.me()).rejects.toThrow();
    await expect(client.player.get([String(u.userId)]).redeemLoginCode(code)).rejects.toThrow();
    await expect(as(u.token).player(u.userId).mintLoginCode()).rejects.toThrow();
  });
});

describe("agent hours", () => {
  test("hours with an agent running rank the board; overlapping agents don't count twice", async () => {
    const busy = await signUp("hoursbusy");
    const light = await signUp("hourslight");
    await as(busy.token)
      .player(busy.userId)
      .ingest([...activity("a", start, 3 * HOUR), ...activity("b", start, 3 * HOUR)]);
    // More tokens, less time: the board by tokens and by hours disagree.
    await as(light.token)
      .player(light.userId)
      .ingest(activity("c", start, HOUR).map((e) => ({ ...e, inputTokens: 1_000_000 })));
    const board = await busy.town.leaderboard("7d", "hours");
    const rows = board.players.filter((p) => p.userId === busy.userId || p.userId === light.userId);
    expect(rows.map((p) => [p.userId, p.activeHours])).toEqual([
      [busy.userId, 3],
      [light.userId, 1],
    ]);
  });
});

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

  test("prompts and PRs count, but add no tokens or agent activity", async () => {
    const pr = { source: "github" as const, sessionId: "github", messageType: "pr" as const, model: "" };
    const s = await statsFor([
      ...activity("a", start, HOUR),
      ...activity("b", start, HOUR).map((e) => ({ ...e, messageType: "user" as const, model: "" })),
      event({ ...pr, timestamp: start, inputTokens: 0, outputTokens: 0 }),
    ]);
    expect(s.parallelism).toBe(1);
    expect(s.prompts).toBe(12);
    expect(s.prs).toBe(1);
    expect(s.turns).toBe(12);
    expect(s.tokens).toBe(12 * 150);
  });
});
