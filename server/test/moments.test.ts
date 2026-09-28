import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { DAY_MS } from "@tokenmaxxing/core/range.ts";
import { openDb } from "../src/db/db.ts";
import { event, HOUR, MIN, NOW, testApp } from "./helpers.ts";

/** One assistant turn worth `tokens`, `ago` ms before NOW. */
const turn = (tokens: number, ago = HOUR) =>
  event({ inputTokens: tokens, outputTokens: 0, timestamp: NOW - ago });

async function world(...names: string[]) {
  const t = testApp();
  const tokens: Record<string, string> = {};
  for (const n of names) tokens[n] = await t.signUp(n);
  const group = async (owner: string, ...members: string[]) => {
    const g = (await t.req("POST", "/api/groups", { token: tokens[owner], body: { name: `g-${owner}` } }))
      .body;
    for (const m of members)
      await t.req("POST", "/api/groups/join", { token: tokens[m], body: { code: g.code } });
    return g.id as number;
  };
  const feed = async (who: string, query = "") =>
    (await t.req("GET", `/api/feed?limit=100${query}`, { token: tokens[who] })).body.moments as {
      id: number;
      kind: string;
      actor: string;
      target: string | null;
      data: Record<string, unknown>;
      reactions: { emoji: string; count: number; mine: boolean }[];
    }[];
  /** Race moments only: level-ups and other achievements show up in most feeds and aren't the point here. */
  const kinds = async (who: string) =>
    (await feed(who))
      .filter((m) => m.kind !== "achievement")
      .map((m) => `${m.kind}:${m.actor}>${m.target ?? ""}`);
  const ingest = (who: string, ...events: ReturnType<typeof turn>[]) => t.ingest(tokens[who]!, events);
  const ingestTz = (who: string, tz: string, ...events: ReturnType<typeof turn>[]) =>
    t.ingest(tokens[who]!, events, tz);
  return { ...t, tokens, group, feed, kinds, ingest, ingestTz };
}

describe("daily race", () => {
  test("passing someone → one overtake, seen by both, not repeated", async () => {
    const w = await world("alice", "bob", "carol");
    await w.group("carol", "alice", "bob");
    await w.ingest("carol", turn(10_000_000));
    await w.ingest("bob", turn(2_000_000));
    await w.ingest("alice", turn(3_000_000));
    expect(await w.kinds("bob")).toContain("overtake:alice>bob");
    expect(await w.kinds("alice")).toContain("overtake:alice>bob");
    await w.ingest("alice", turn(100_000));
    expect((await w.kinds("bob")).filter((k) => k.startsWith("overtake"))).toHaveLength(1);
  });

  test("taking #1 is a take_lead, not also an overtake of the leader", async () => {
    const w = await world("alice", "bob");
    await w.group("bob", "alice");
    await w.ingest("bob", turn(2_000_000));
    await w.ingest("alice", turn(3_000_000));
    expect(await w.kinds("bob")).toEqual(["take_lead:alice>bob"]);
  });

  test("close behind someone → close_gap", async () => {
    const w = await world("alice", "bob");
    await w.group("bob", "alice");
    await w.ingest("bob", turn(10_000_000));
    await w.ingest("alice", turn(9_500_000));
    const gap = (await w.feed("alice")).find((m) => m.kind === "close_gap");
    expect(gap).toMatchObject({ kind: "close_gap", target: "bob", data: { gap: 500_000, rank: 1 } });
  });

  test("passing someone under RACE_MIN_TOKENS is not news (just after midnight)", async () => {
    const w = await world("alice", "bob");
    await w.group("bob", "alice");
    await w.ingest("bob", turn(500_000));
    await w.ingest("alice", turn(600_000));
    expect(await w.feed("bob")).toEqual([]);
  });

  test("passing 3 at once is one climb", async () => {
    const w = await world("alice", "xx", "yy", "zz", "lead");
    await w.group("lead", "alice", "xx", "yy", "zz");
    await w.ingest("lead", turn(50_000_000));
    await w.ingest("xx", turn(2_000_000));
    await w.ingest("yy", turn(3_000_000));
    await w.ingest("zz", turn(4_000_000));
    await w.ingest("alice", turn(5_000_000));
    const mine = (await w.kinds("alice")).filter((k) => k.includes("alice>"));
    expect(mine).toEqual(["climb:alice>"]);
    expect((await w.feed("alice")).find((m) => m.kind === "climb")?.data).toMatchObject({ from: 5, to: 2 });
  });

  test("a backfill of old history fires nothing", async () => {
    const w = await world("alice", "bob");
    await w.group("bob", "alice");
    await w.ingest("bob", turn(2_000_000, 3 * DAY_MS));
    await w.ingest("alice", turn(3_000_000, 3 * DAY_MS));
    expect(await w.feed("alice")).toEqual([]);
  });

  test("privacy: a groupmate of alice never sees bob, whom they don't share a group with", async () => {
    const w = await world("alice", "bob", "carol", "dave");
    await w.group("dave", "alice", "bob");
    await w.group("carol", "alice");
    await w.ingest("dave", turn(20_000_000));
    await w.ingest("bob", turn(2_000_000));
    await w.ingest("alice", turn(3_000_000));
    expect(await w.kinds("bob")).toContain("overtake:alice>bob");
    const seen = await w.feed("carol");
    expect(seen.some((m) => m.actor === "bob" || m.target === "bob")).toBe(false);
  });

  test("a group's today is its owner's day", async () => {
    const w = await world("alice", "bob");
    // Kiritimati is UTC+14: at NOW (12:00 UTC) it's already 02:00 the next day there.
    await w.ingestTz("bob", "Pacific/Kiritimati", turn(1000, 10 * MIN));
    const g = await w.group("bob", "alice");
    await w.ingest("alice", turn(5000, 3 * HOUR)); // 09:00 UTC = 23:00 yesterday in Kiritimati
    const inGroup = (await w.req("GET", `/api/leaderboard?range=today&group=${g}`, { token: w.tokens.alice }))
      .body.entries;
    const mine = (await w.req("GET", "/api/leaderboard?range=today", { token: w.tokens.alice })).body.entries;
    expect(inGroup.find((e: { name: string }) => e.name === "alice").tokens).toBe(0);
    expect(mine.find((e: { name: string }) => e.name === "alice").tokens).toBe(5000);
  });
});

describe("daily titles", () => {
  test("yesterday's winners are written once and shown on today's board", async () => {
    const w = await world("alice", "bob", "carol");
    await w.group("alice", "bob", "carol");
    w.setNow(NOW - DAY_MS);
    await w.ingest(
      "alice",
      turn(5_000_000, DAY_MS + HOUR),
      event({
        messageType: "pr",
        model: "",
        timestamp: NOW - DAY_MS - HOUR,
        messageId: "pr1",
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
    await w.ingest("bob", turn(3_000_000, DAY_MS + HOUR));
    w.setNow(NOW);
    await w.feed("bob");
    await w.feed("carol");
    const titles = (await w.feed("bob")).filter((m) => m.kind === "day_title");
    expect(titles.map((m) => [m.actor, m.data.category, m.data.value])).toEqual([
      ["alice", "tokens", 5_000_000],
      ["alice", "prs", 1],
    ]);
    const board = (await w.req("GET", "/api/leaderboard?range=today", { token: w.tokens.bob })).body.entries;
    expect(board.find((e: { name: string }) => e.name === "alice").titles).toEqual(["👑", "🚢"]);
    const me = (await w.req("GET", "/api/me", { token: w.tokens.alice })).body;
    expect(me.progress).toMatchObject({ daysWon30: 1, winStreak: 1 });
  });

  test("no titles when fewer than 2 members were active", async () => {
    const w = await world("alice", "bob");
    await w.group("alice", "bob");
    await w.ingest("alice", turn(5_000_000, DAY_MS + HOUR));
    expect(await w.feed("alice")).toEqual([]);
  });

  test("three wins in a row unlock hat_trick", async () => {
    const w = await world("alice", "bob");
    await w.group("alice", "bob");
    for (let d = 3; d >= 1; d--) {
      await w.ingest("alice", turn(5_000_000, d * DAY_MS + HOUR));
      await w.ingest("bob", turn(1_000_000, d * DAY_MS + HOUR));
      w.setNow(NOW - (d - 1) * DAY_MS);
      await w.feed("alice");
    }
    const me = (await w.req("GET", "/api/me", { token: w.tokens.alice })).body.progress;
    expect(me.winStreak).toBe(3);
    expect(me.achievements.map((a: { key: string }) => a.key)).toContain("hat_trick");
  });
});

describe("personal moments", () => {
  test("level-up, hydra and personal best", async () => {
    const w = await world("alice");
    await w.ingest("alice", turn(2_000_000, 2 * DAY_MS)); // yesterday's-yesterday best: 2M
    w.setNow(NOW + 2 * DAY_MS);
    const hydra = Array.from({ length: 10 }, (_, i) =>
      event({
        sessionId: `s${i}`,
        inputTokens: 300_000,
        outputTokens: 0,
        timestamp: NOW + 2 * DAY_MS - 10 * MIN,
      }),
    );
    await w.ingest("alice", ...hydra);
    const kinds = (await w.feed("alice")).map((m) => `${m.kind}:${m.data.key ?? ""}`);
    expect(kinds).toContain("achievement:level");
    expect(kinds).toContain("achievement:hydra");
    expect(kinds).toContain("personal_best:");
  });
});

describe("chat", () => {
  test("members post and read; others get 404; leaving hides it", async () => {
    const w = await world("alice", "bob", "eve");
    const g = await w.group("alice", "bob");
    const post = (who: string, text: unknown) =>
      w.req("POST", `/api/groups/${g}/messages`, { token: w.tokens[who], body: { text } });
    expect((await post("alice", "  hi @bob\n")).body).toMatchObject({
      kind: "chat",
      data: { text: "hi @bob" },
    });
    expect((await post("eve", "let me in")).status).toBe(404);
    expect((await w.req("GET", `/api/feed?group=${g}`, { token: w.tokens.eve })).status).toBe(404);
    expect((await w.feed("bob", `&group=${g}`)).map((m) => m.data.text)).toEqual(["hi @bob"]);
    expect((await post("alice", "x".repeat(501))).status).toBe(400);
    expect((await post("alice", "   ")).status).toBe(400);
    await w.req("DELETE", `/api/groups/${g}/members/me`, { token: w.tokens.bob });
    expect(await w.feed("bob")).toEqual([]);
  });

  test("the 21st message in a minute is rate limited", async () => {
    const w = await world("alice", "bob");
    const g = await w.group("alice", "bob");
    for (let i = 0; i < 20; i++) {
      await w.req("POST", `/api/groups/${g}/messages`, { token: w.tokens.alice, body: { text: `m${i}` } });
    }
    const r = await w.req("POST", `/api/groups/${g}/messages`, {
      token: w.tokens.alice,
      body: { text: "one more" },
    });
    expect(r.status).toBe(429);
  });

  test("only my own chat messages can be deleted", async () => {
    const w = await world("alice", "bob");
    const g = await w.group("alice", "bob");
    await w.ingest("bob", turn(2_000_000));
    await w.ingest("alice", turn(3_000_000));
    const lead = (await w.feed("alice")).find((m) => m.kind === "take_lead")!;
    const msg = (
      await w.req("POST", `/api/groups/${g}/messages`, { token: w.tokens.bob, body: { text: "hey" } })
    ).body;
    expect((await w.req("DELETE", `/api/feed/${msg.id}`, { token: w.tokens.alice })).status).toBe(404);
    expect((await w.req("DELETE", `/api/feed/${lead.id}`, { token: w.tokens.alice })).status).toBe(404);
    expect((await w.req("DELETE", `/api/feed/${msg.id}`, { token: w.tokens.bob })).status).toBe(200);
  });

  test("a rename keeps authorship", async () => {
    const w = await world("alice", "bob");
    const g = await w.group("alice", "bob");
    await w.req("POST", `/api/groups/${g}/messages`, { token: w.tokens.alice, body: { text: "hi" } });
    await w.req("PATCH", "/api/me", { token: w.tokens.alice, body: { name: "alicia" } });
    expect((await w.feed("bob")).map((m) => m.actor)).toEqual(["alicia"]);
  });
});

describe("reactions", () => {
  test("toggle, counts per user, validation, visibility, cascade", async () => {
    const w = await world("alice", "bob", "eve");
    const g = await w.group("alice", "bob");
    const msg = (
      await w.req("POST", `/api/groups/${g}/messages`, { token: w.tokens.alice, body: { text: "gg" } })
    ).body;
    const react = (who: string, emoji: string, id = msg.id) =>
      w.req("POST", `/api/feed/${id}/reactions`, { token: w.tokens[who], body: { emoji } });

    await react("alice", "🔥");
    expect((await react("bob", "🔥")).body.reactions).toEqual([{ emoji: "🔥", count: 2, mine: true }]);
    await react("bob", "💀");
    const [m] = await w.feed("alice");
    expect(m!.reactions).toEqual([
      { emoji: "🔥", count: 2, mine: true },
      { emoji: "💀", count: 1, mine: false },
    ]);
    await react("alice", "🔥");
    expect((await w.feed("alice"))[0]!.reactions[0]).toEqual({ emoji: "🔥", count: 1, mine: false });

    expect((await react("alice", "🍕")).status).toBe(400);
    expect((await react("eve", "🔥")).status).toBe(404);

    await w.req("DELETE", `/api/feed/${msg.id}`, { token: w.tokens.alice });
    expect(w.db.query("SELECT COUNT(*) AS n FROM reactions").get()).toEqual({ n: 0 });
  });
});

test("migrations run once and leave user_version at the latest", () => {
  const path = `/tmp/tm-migrate-${process.pid}.sqlite`;
  const a = openDb(path);
  a.close();
  const b = openDb(path);
  expect(b.query("PRAGMA user_version").get()).toEqual({ user_version: 2 });
  b.close();
  for (const f of [path, `${path}-wal`, `${path}-shm`]) rmSync(f, { force: true });
});
