import { expect, test } from "bun:test";
import type { Client } from "rivetkit/client";
import { migrateEvents, player, report, USAGE_MINUTE_CAP } from "../src/actors/player.ts";
import type { registry } from "../src/actors/registry.ts";
import { type Sql, serial } from "../src/actors/shared.ts";
import type { ActivityDay, UsageDay } from "../src/actors/town.ts";
import { RateLimiter } from "../src/rate-limit.ts";
import { coalesceBattleUpdates, flushUsageReports } from "../src/usage-reports.ts";
import { memorySql } from "./memory-sql.ts";

test("a stuck battle cannot delay ingest acknowledgements or the next batch", async () => {
  const ingest = player.config.actions!.ingest;
  const { db, sql } = memorySql();
  const stalled = Promise.withResolvers<void>();
  const background: Promise<unknown>[] = [];
  let calls = 0;
  const client = {
    town: { getOrCreate: () => ({ report: async () => {} }) },
    world: { getOrCreate: () => ({ activity: async () => {} }) },
    arcade: {
      getOrCreate: () => ({
        usage: () => {
          calls++;
          return stalled.promise;
        },
      }),
    },
  };
  const ctx = {
    state: { userId: 42 },
    conn: { state: { kind: "user", userId: 42, via: "device" } },
    vars: { serial: serial(), ingests: new RateLimiter(60, 60_000), battleUpdate: coalesceBattleUpdates() },
    abortSignal: new AbortController().signal,
    client: () => client,
    waitUntil: (p: Promise<unknown>) => {
      background.push(p);
    },
    db: {
      execute: sql.execute,
      transaction: async <T>(fn: (tx: Sql) => Promise<T>): Promise<T> => {
        db.run("BEGIN");
        try {
          const result = await fn(sql);
          db.run("COMMIT");
          return result;
        } catch (err) {
          db.run("ROLLBACK");
          throw err;
        }
      },
    },
  } as unknown as Parameters<typeof ingest>[0];
  try {
    await migrateEvents(sql);
    const event = {
      source: "claude_code",
      sessionId: "s",
      agentId: null,
      requestId: null,
      timestamp: Date.now(),
      model: "claude-haiku-4-5-20251001",
      messageType: "assistant",
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      reasoningTokens: null,
    };
    for (let i = 0; i < 3; i++) {
      const result = await Promise.race([
        ingest(ctx, [{ ...event, messageId: `m${i}` }]),
        Bun.sleep(200).then(() => {
          throw new Error("ingest waited for the battle");
        }),
      ]);
      expect(result).toEqual({ inserted: 1, duplicates: 0, skipped: 0 });
    }
    expect(calls).toBe(1);
    stalled.resolve();
    await Promise.all(background);
    expect(calls).toBe(2);
    expect(db.query("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 3 });
  } finally {
    stalled.resolve();
    await Promise.all(background);
    db.close();
  }
});

test("a failed battle update allows a new update on the next sync", async () => {
  const update = coalesceBattleUpdates();
  await expect(
    update(() => {
      throw new Error("match timed out");
    }),
  ).rejects.toThrow("match timed out");
  let recovered = false;
  await update(async () => {
    recovered = true;
  });
  expect(recovered).toBe(true);
});

test("upgrading an existing database repairs historic days once and preserves its raw events", async () => {
  const { db, sql } = memorySql();
  try {
    await migrateEvents(sql);
    db.run(`INSERT INTO events (source, session_id, message_id, timestamp, day, model, message_type,
      input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
      VALUES ('claude_code', 's', 'm1', 1, '2026-09-29', 'a', 'assistant', 100, 50, 0, 0)`);
    // An older installation has no repair marker or partial index.
    db.run("DROP TABLE usage_report_migrations");
    db.run("DROP INDEX events_assistant_time");
    await migrateEvents(sql);
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([{ day: "2026-09-29" }]);
    expect(db.query("SELECT input_tokens FROM events").all()).toEqual([{ input_tokens: 100 }]);
    await flushUsageReports(sql, async () => {});
    await migrateEvents(sql);
    expect(db.query("SELECT day FROM pending_usage_days").all()).toEqual([]);
  } finally {
    db.close();
  }
});

test("failed reports stay queued and recover with a later request", async () => {
  const { db, sql } = memorySql();
  try {
    db.run("CREATE TABLE pending_usage_days (day TEXT PRIMARY KEY)");
    db.run("INSERT INTO pending_usage_days VALUES ('2026-09-28'), ('2026-09-29')");
    await expect(
      flushUsageReports(sql, async () => {
        throw new Error("town offline");
      }),
    ).rejects.toThrow("town offline");
    expect(db.query("SELECT COUNT(*) AS n FROM pending_usage_days").get()).toEqual({ n: 2 });
    // A new batch may contain only duplicates or no events. The pending older days still report.
    const reports: string[][] = [];
    await flushUsageReports(sql, async (days) => {
      reports.push(days);
    });
    expect(reports).toEqual([["2026-09-28", "2026-09-29"]]);
    expect(db.query("SELECT COUNT(*) AS n FROM pending_usage_days").get()).toEqual({ n: 0 });
  } finally {
    db.close();
  }
});

test("repair reports are bounded, and a failed later chunk keeps its days", async () => {
  const { db, sql } = memorySql();
  try {
    db.run("CREATE TABLE pending_usage_days (day TEXT PRIMARY KEY)");
    for (let i = 1; i <= 20; i++)
      db.run("INSERT INTO pending_usage_days VALUES (?)", [`2026-09-${String(i).padStart(2, "0")}`]);
    let calls = 0;
    await expect(
      flushUsageReports(sql, async (days) => {
        expect(days.length).toBeLessThanOrEqual(7);
        if (++calls === 2) throw new Error("retry");
      }),
    ).rejects.toThrow("retry");
    expect(db.query("SELECT COUNT(*) AS n FROM pending_usage_days").get()).toEqual({ n: 13 });
    await flushUsageReports(sql, async () => {});
    expect(db.query("SELECT COUNT(*) AS n FROM pending_usage_days").get()).toEqual({ n: 0 });
  } finally {
    db.close();
  }
});

test("grouped rollups preserve per-model caps, activity, and indexed recent-agent reads", async () => {
  const { db, sql } = memorySql();
  try {
    db.run(`CREATE TABLE events (day TEXT, model TEXT, timestamp INTEGER, message_type TEXT,
      session_id TEXT, agent_id TEXT, input_tokens INTEGER, output_tokens INTEGER,
      cache_creation_tokens INTEGER, cache_read_tokens INTEGER)`);
    db.run("CREATE INDEX events_day ON events (day, message_type)");
    db.run(
      "CREATE INDEX events_assistant_time ON events (timestamp, session_id, agent_id) WHERE message_type = 'assistant'",
    );
    const now = Date.UTC(2026, 8, 30, 12);
    const add = (
      day: string,
      model: string,
      time: number,
      type: string,
      session: string,
      input: number,
      output = 0,
      creation = 0,
      read = 0,
    ) =>
      db.run("INSERT INTO events VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)", [
        day,
        model,
        time,
        type,
        session,
        input,
        output,
        creation,
        read,
      ]);
    add("2026-09-30", "a", now - 60_000, "assistant", "one", USAGE_MINUTE_CAP, 100, 200, 300);
    add("2026-09-30", "b", now - 60_000, "assistant", "two", USAGE_MINUTE_CAP);
    add("2026-09-30", "a", now, "user", "one", 0);
    add("2026-09-30", "", now, "pr", "github", 0);
    add("2026-09-29", "a", now - 86_400_000, "assistant", "old", 10, 20, 30, 40);
    let usage: UsageDay[] = [];
    let activity: ActivityDay[] = [];
    let recent: unknown[] = [];
    const client = {
      town: {
        getOrCreate: () => ({
          report: async (_id: number, _days: string[], u: UsageDay[], a: ActivityDay[]) => {
            usage = u;
            activity = a;
          },
        }),
      },
      world: {
        getOrCreate: () => ({
          activity: async (...args: unknown[]) => {
            recent = args;
          },
        }),
      },
      arcade: { getOrCreate: () => ({}) },
    } as unknown as Client<typeof registry>;
    const queries: string[] = [];
    await report(
      {
        execute: async (q, ...args) => {
          queries.push(q);
          return sql.execute(q, ...args);
        },
      },
      client,
      42,
      ["2026-09-29", "2026-09-30"],
      now,
    );
    expect(usage.find((r) => r.day === "2026-09-29")).toMatchObject({
      input: 10,
      output: 20,
      cacheCreation: 30,
      cacheRead: 40,
      turns: 1,
    });
    const today = usage.filter((r) => r.day === "2026-09-30");
    const factor = USAGE_MINUTE_CAP / (2 * USAGE_MINUTE_CAP + 600);
    expect(today.find((r) => r.model === "a")).toMatchObject({
      input: Math.floor(USAGE_MINUTE_CAP * factor),
      output: Math.floor(100 * factor),
      cacheCreation: Math.floor(200 * factor),
      cacheRead: Math.floor(300 * factor),
      turns: 1,
    });
    expect(today.find((r) => r.model === "b")?.input).toBe(Math.floor(USAGE_MINUTE_CAP * factor));
    expect(activity.find((r) => r.day === "2026-09-30")).toMatchObject({
      prompts: 1,
      prs: 1,
      agentBuckets: 2,
      activeBuckets: 1,
      peakAgents: 2,
      capped: USAGE_MINUTE_CAP + 600,
    });
    expect(recent).toEqual([42, now - 60_000, 2]);
    // Both live queries use the partial index; neither scans all historic assistant events.
    for (const q of queries.slice(-2)) {
      const args = q.includes("timestamp > ?") ? [now - 600_000] : [];
      const plan = db.query(`EXPLAIN QUERY PLAN ${q}`).all(...args) as { detail: string }[];
      expect(
        plan.some(
          (r) => r.detail.includes("SEARCH events USING") && r.detail.includes("events_assistant_time"),
        ),
      ).toBe(true);
    }
  } finally {
    db.close();
  }
});
