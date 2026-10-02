import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchCursorUsage, loadCursorCredentials } from "../src/sources/cursor-api.ts";
import { loadState } from "../src/sync/state.ts";
import { sync } from "../src/sync/sync.ts";
import type { Source, TokenEvent } from "../src/types.ts";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "cursor-api-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const credentials = () => ({ accountId: "account-hash", cookie: "WorkosCursorSessionToken=secret" });
const until = Date.UTC(2026, 9, 2);
const row = (timestamp = until - 1000) => ({
  timestamp: String(timestamp),
  model: "claude-4.6-opus",
  kind: "Included",
  tokenUsage: { inputTokens: 10, outputTokens: 20, cacheWriteTokens: 30, cacheReadTokens: 40 },
});
const page = (rows: unknown[], total = rows.length) =>
  Response.json({
    usageEventsDisplay: rows,
    totalUsageEventsCount: total,
  });
const fetcher = (fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
  fn as typeof fetch;
const options = { dbPath: "unused", since: 0, until, credentials, pageSize: 100 };

function database(value: string): string {
  const path = join(directory(), "state.vscdb");
  const db = new Database(path);
  db.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)");
  db.query("INSERT INTO ItemTable VALUES ('cursorAuth/accessToken', ?)").run(value);
  db.close();
  return path;
}

function jwt(subject: string): string {
  return `header.${Buffer.from(JSON.stringify({ sub: subject })).toString("base64url")}.signature`;
}

describe("Cursor dashboard", () => {
  test("loads a read-only JWT and derives the cookie from the final subject component", () => {
    const token = jwt("provider|user_123");
    const c = loadCursorCredentials(database(token));
    expect(c.cookie).toBe(`WorkosCursorSessionToken=user_123%3A%3A${token}`);
    expect(c.accountId).toMatch(/^[a-f0-9]{64}$/);
    expect(loadCursorCredentials(database(jwt("user_123"))).accountId).toBe(c.accountId);
  });

  test("malformed credentials never appear in errors", () => {
    for (const token of ["secret-do-not-log", jwt("bad\r\nCookie: secret"), jwt("")]) {
      expect(() => loadCursorCredentials(database(token))).toThrow("Cursor credentials unavailable");
    }
    expect(() => loadCursorCredentials(join(directory(), "missing"))).toThrow(
      "Cursor credentials unavailable",
    );
  });

  test("paginates and maps actual counts without exposing credentials or content", async () => {
    const bodies: Record<string, unknown>[] = [];
    const first = Array.from({ length: 100 }, (_, i) => ({ ...row(until - i - 1), text: "private content" }));
    const r = await fetchCursorUsage({
      ...options,
      fetch: fetcher(async (url, init) => {
        expect(url).toBe("https://cursor.com/api/dashboard/get-filtered-usage-events");
        expect(new Headers(init?.headers).get("Cookie")).toBe(credentials().cookie);
        expect(init?.redirect).toBe("error");
        bodies.push(JSON.parse(String(init?.body)));
        return bodies.length === 1 ? page(first, 101) : page([row(until - 1001)], 101);
      }),
    });
    expect(bodies.map((b) => [b.page, b.pageSize, b.startDate, b.endDate])).toEqual([
      [1, 100, "0", String(until)],
      [2, 100, "0", String(until)],
    ]);
    expect(r.events).toHaveLength(101);
    expect(r.events[0]).toMatchObject({
      source: "cursor_local",
      timestamp: until - 1,
      inputTokens: 10,
      outputTokens: 20,
      cacheCreationTokens: 30,
      cacheReadTokens: 40,
    });
    expect(JSON.stringify(r)).not.toContain("secret");
    expect(JSON.stringify(r)).not.toContain("private content");
  });

  test("maps reported costs with cursorbar precedence and preserves zero and missing costs", async () => {
    const rows = [
      { ...row(), chargedCents: 0, tokenUsage: { ...row().tokenUsage, totalCents: 123 } },
      { ...row(), chargedCents: 2.75, tokenUsage: { ...row().tokenUsage, totalCents: 123 } },
      { ...row(), tokenUsage: { ...row().tokenUsage, totalCents: 4.125 } },
      row(),
    ];
    const result = await fetchCursorUsage({ ...options, fetch: fetcher(async () => page(rows)) });
    expect(result.events.map((e) => e.costCents)).toEqual([0, 2.75, 4.125, null]);
    const noCosts = await fetchCursorUsage({
      ...options,
      fetch: fetcher(async () =>
        page(
          rows.map((r) => ({
            ...r,
            chargedCents: undefined,
            tokenUsage: row().tokenUsage,
          })),
        ),
      ),
    });
    expect(result.events.map((e) => e.messageId)).toEqual(noCosts.events.map((e) => e.messageId));
  });

  test("rejects malformed reported costs", async () => {
    for (const chargedCents of [-1, "4", 100_000_001]) {
      await expect(
        fetchCursorUsage({ ...options, fetch: fetcher(async () => page([{ ...row(), chargedCents }])) }),
      ).rejects.toThrow("Invalid Cursor cost");
    }
  });

  test("skips Grok automation while preserving other Grok models and pagination", async () => {
    const r = await fetchCursorUsage({
      ...options,
      pageSize: 1,
      fetch: fetcher(async (_url, init) => {
        const { page: number } = JSON.parse(String(init?.body));
        return page([{ ...row(), model: number === 1 ? "grok-bot-automation" : "grok-bot-default" }], 2);
      }),
    });
    expect(r.events.map((e) => e.model)).toEqual(["grok-bot-default"]);
  });

  test("IDs survive page shifts and preserve identical rows", async () => {
    const run = (rows: unknown[]) => fetchCursorUsage({ ...options, fetch: fetcher(async () => page(rows)) });
    const a = await run([row(), row()]);
    const b = await run([row(until - 1), row(), row()]);
    expect(a.events.map((e) => e.messageId)).toEqual(b.events.slice(1).map((e) => e.messageId));
    expect(a.events[0]!.messageId).not.toBe(a.events[1]!.messageId);
  });

  test("reloads credentials once after 401, and rejects an account change", async () => {
    let loads = 0;
    let calls = 0;
    const run = (accountChanged: boolean) =>
      fetchCursorUsage({
        ...options,
        credentials: () => ({
          accountId: accountChanged && loads++ > 0 ? "other" : "same",
          cookie: String(loads++),
        }),
        fetch: fetcher(async () => (++calls % 2 === 1 ? new Response(null, { status: 401 }) : page([row()]))),
      });
    expect((await run(false)).events).toHaveLength(1);
    loads = 0;
    calls = 0;
    await expect(run(true)).rejects.toThrow("Cursor usage request failed");
  });

  test("an account change before the first page cannot reuse another account's window", async () => {
    await expect(
      fetchCursorUsage({
        ...options,
        expectedAccountId: "other",
        fetch: fetcher(async () => {
          throw new Error("must not fetch");
        }),
      }),
    ).rejects.toThrow("Cursor account changed during sync");
  });

  test("a later-page failure rejects the whole window", async () => {
    let calls = 0;
    await expect(
      fetchCursorUsage({
        ...options,
        fetch: fetcher(async () =>
          ++calls === 1
            ? page(
                Array.from({ length: 100 }, (_, i) => row(until - i - 1)),
                101,
              )
            : new Response(null, { status: 500 }),
        ),
      }),
    ).rejects.toThrow("HTTP 500");
    expect(calls).toBe(2);
  });

  test("an empty final page cannot commit a truncated window", async () => {
    let calls = 0;
    await expect(
      fetchCursorUsage({
        ...options,
        fetch: fetcher(async () =>
          ++calls === 1
            ? page(
                Array.from({ length: 100 }, (_, i) => row(until - i - 1)),
                101,
              )
            : page([], 101),
        ),
      }),
    ).rejects.toThrow("Incomplete Cursor usage response");
  });

  test("does not fabricate tokens for requests without a breakdown", async () => {
    const r = await fetchCursorUsage({
      ...options,
      fetch: fetcher(async () =>
        page([{ ...row(), tokenUsage: null }, { ...row(), tokenUsage: undefined }, row()]),
      ),
    });
    expect(r.events).toHaveLength(1);
  });

  test("rejects incomplete pages, malformed counts, HTTP and transport failures safely", async () => {
    for (const response of [
      page([], 101),
      Response.json({}),
      page([{ ...row(), tokenUsage: { inputTokens: -1 } }]),
      page([{ ...row(), timestamp: "invalid" }]),
      new Response("credential secret", { status: 403 }),
      new Response("credential secret"),
    ]) {
      await expect(fetchCursorUsage({ ...options, fetch: fetcher(async () => response) })).rejects.toThrow();
    }
    await expect(
      fetchCursorUsage({
        ...options,
        fetch: fetcher(async () => {
          throw new Error("secret");
        }),
      }),
    ).rejects.toThrow("Cursor usage request failed");
  });
});

describe("Cursor sync checkpoint", () => {
  const enabled = new Set<Source>(["cursor_local"]);
  const send = async (events: TokenEvent[]) => ({ inserted: events.length, duplicates: 0 });
  test("checks every 15 minutes, overlaps seven days, and backfills a new account", async () => {
    const requests: Record<string, unknown>[] = [];
    let accountId = "first";
    const opts = {
      enabled,
      send,
      statePath: join(directory(), "sync.json"),
      cursorCredentials: () => ({ ...credentials(), accountId }),
      cursorFetch: fetcher(async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return page([row()]);
      }),
    };
    let state = (await sync({ files: {} }, { ...opts, now: () => until })).state;
    state = (await sync(state, { ...opts, now: () => until + 60_000 })).state;
    expect(requests).toHaveLength(1);
    state = (await sync(state, { ...opts, now: () => until + 15 * 60_000 })).state;
    expect(requests[1]!.startDate).toBe(String(until - 7 * 24 * 60 * 60_000));
    accountId = "second";
    await sync(state, { ...opts, now: () => until + 30 * 60_000 });
    expect(requests[2]!.startDate).toBe("0");
    expect(JSON.stringify(await loadState(opts.statePath))).not.toContain("secret");
  });

  test("a failed send or API page never advances the Cursor checkpoint", async () => {
    const statePath = join(directory(), "sync.json");
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async () => page([row()])),
    };
    await expect(
      sync(
        { files: {} },
        {
          ...opts,
          send: async () => {
            throw new Error("offline");
          },
        },
      ),
    ).rejects.toThrow("offline");
    expect((await loadState(statePath)).cursorApi).toBeUndefined();
    let failures = 0;
    const result = await sync(
      { files: {} },
      {
        ...opts,
        send,
        onError: () => {
          failures++;
        },
        cursorFetch: fetcher(async () => new Response(null, { status: 401 })),
      },
    );
    expect(failures).toBe(1);
    expect(result.state.cursorApi).toBeUndefined();
    expect((await sync(result.state, { ...opts, send })).state.cursorApi?.checkedAt).toBe(until);
  });

  test("a partially acknowledged backfill replays stable IDs before committing", async () => {
    const statePath = join(directory(), "sync.json");
    const rows = Array.from({ length: 1101 }, (_, i) => row(until - i - 1));
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        const offset = (request.page - 1) * request.pageSize;
        return page(rows.slice(offset, offset + request.pageSize), rows.length);
      }),
    };
    const stored = new Set<string>();
    let sends = 0;
    const sizes: number[] = [];
    const sending = async (events: TokenEvent[]) => {
      sizes.push(events.length);
      if (++sends === 2) throw new Error("offline");
      const before = stored.size;
      for (const e of events) stored.add(e.messageId);
      return { inserted: stored.size - before, duplicates: events.length - (stored.size - before) };
    };
    await expect(sync({ files: {} }, { ...opts, send: sending })).rejects.toThrow("offline");
    const state = await loadState(statePath);
    expect(state.cursorApi).toBeUndefined();
    const result = await sync(state, { ...opts, send: sending });
    expect(sizes).toEqual([1000, 101, 1000, 101]);
    expect(stored.size).toBe(1101);
    expect(result.inserted).toBe(101);
    expect(result.state.cursorApi?.checkedAt).toBe(until);
  });

  test("sends history pages progressively and replays a failed window without advancing", async () => {
    const statePath = join(directory(), "sync.json");
    const rows = Array.from({ length: 1001 }, (_, i) => row(until - i - 1));
    const stored = new Set<string>();
    let failSecondPage = true;
    let sentBeforeSecondPage = false;
    const opts = {
      statePath,
      enabled,
      cursorCredentials: credentials,
      now: () => until,
      cursorFetch: fetcher(async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.pageSize).toBe(1000);
        if (request.page === 2) {
          sentBeforeSecondPage = stored.size === 1000;
          if (failSecondPage) return new Response(null, { status: 500 });
        }
        const offset = (request.page - 1) * request.pageSize;
        return page(rows.slice(offset, offset + request.pageSize), rows.length);
      }),
      send: async (events: TokenEvent[]) => {
        const before = stored.size;
        for (const e of events) stored.add(e.messageId);
        return { inserted: stored.size - before, duplicates: events.length - (stored.size - before) };
      },
    };
    const first = await sync({ files: {} }, opts);
    expect(sentBeforeSecondPage).toBe(true);
    expect(first.inserted).toBe(1000);
    expect((await loadState(statePath)).cursorApi).toBeUndefined();
    failSecondPage = false;
    const second = await sync(first.state, opts);
    expect(second.inserted).toBe(1);
    expect(stored.size).toBe(1001);
    expect(second.state.cursorApi?.checkedAt).toBe(until);
  });

  test("upgrades earlier checkpoints with a full cost replay before throttling", async () => {
    for (const costVersion of [undefined, 1]) {
      const requests: Record<string, unknown>[] = [];
      const result = await sync(
        { files: {}, cursorApi: { accountId: credentials().accountId, checkedAt: until, costVersion } },
        {
          statePath: join(directory(), "sync.json"),
          enabled,
          send,
          now: () => until,
          cursorCredentials: credentials,
          cursorFetch: fetcher(async (_url, init) => {
            requests.push(JSON.parse(String(init?.body)));
            return page([{ ...row(), chargedCents: 2 }]);
          }),
        },
      );
      expect(requests[0]!.startDate).toBe("0");
      expect(result.state.cursorApi?.costVersion).toBe(2);
    }
  });

  test("disabled Cursor never loads credentials or sends API requests", async () => {
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled: new Set(),
        send,
        cursorCredentials: () => {
          throw new Error("must not read");
        },
        cursorFetch: fetcher(async () => {
          throw new Error("must not fetch");
        }),
      },
    );
  });
});
