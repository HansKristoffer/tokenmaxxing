import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sync } from "../src/sync/sync.ts";
import type { Source, TokenEvent } from "../src/types.ts";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "antigravity-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const enabled = new Set<Source>(["antigravity"]);

// A minimal protobuf writer, for the fields Antigravity's rows carry.
type Field = [no: number, value: number | string | Uint8Array];

const varint = (n: number) => {
  const out: number[] = [];
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
  return out;
};

const message = (...fs: Field[]): Uint8Array =>
  new Uint8Array(
    fs.flatMap(([no, v]) => {
      if (typeof v === "number") return [...varint(no * 8), ...varint(v)];
      const bytes = typeof v === "string" ? new TextEncoder().encode(v) : v;
      return [...varint(no * 8 + 2), ...varint(bytes.length), ...bytes];
    }),
  );

const timestamp = (ms: number) => message([1, Math.floor(ms / 1000)], [2, (ms % 1000) * 1e6]);

/** One model call: usage, start time, model and a prompt that must never be read. */
const call = (at: number, model: string) =>
  message(
    [
      1,
      message(
        [3, "secret prompt"],
        [4, message([2, 100], [3, 30], [4, 50], [5, 1000], [9, 10], [10, 20], [11, `resp-${at}`])],
        [9, message([4, timestamp(at)])],
        [19, model],
      ),
    ],
    [2, 1],
  );

/** An Antigravity 2 conversation under `<dir>/conversations/`. */
function conversation(dir: string, id: string) {
  mkdirSync(join(dir, "conversations"), { recursive: true });
  const path = join(dir, "conversations", `${id}.db`);
  const db = new Database(path);
  db.exec("CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)");
  db.exec("CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, metadata BLOB)");
  return {
    path,
    db,
    call: (idx: number, at: number, model = "gemini-3-pro") =>
      db.query("INSERT INTO gen_metadata VALUES (?, ?)").run(idx, call(at, model)),
    // 14 is a user message.
    step: (idx: number, at: number, type = 14) =>
      db.query("INSERT INTO steps VALUES (?, ?, ?)").run(idx, type, message([1, timestamp(at)])),
  };
}

const collector = () => {
  const sent: TokenEvent[] = [];
  return {
    sent,
    send: async (events: TokenEvent[]) => {
      sent.push(...events);
      return { inserted: events.length, duplicates: 0 };
    },
  };
};

describe("Antigravity", () => {
  test("reads model calls and user messages, once, without their content", async () => {
    const dir = directory();
    const c = conversation(dir, "cascade-1");
    c.step(0, 1_700_000_000_000);
    c.step(1, 1_700_000_000_500, 3);
    c.call(0, 1_700_000_001_000);
    c.db.close();

    const statePath = join(directory(), "state.json");
    const { sent, send } = collector();
    const first = await sync({ files: {} }, { statePath, enabled, send, dirs: { antigravity: [dir] } });

    expect(sent).toEqual([
      {
        source: "antigravity",
        sessionId: "cascade-1",
        agentId: null,
        messageId: "cascade-1:step:0",
        requestId: null,
        timestamp: 1_700_000_000_000,
        model: "",
        messageType: "user",
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: null,
      },
      {
        source: "antigravity",
        sessionId: "cascade-1",
        agentId: null,
        messageId: "cascade-1:gen:0",
        requestId: "resp-1700000001000",
        timestamp: 1_700_000_001_000,
        model: "gemini-3-pro",
        messageType: "assistant",
        inputTokens: 100,
        outputTokens: 30,
        cacheCreationTokens: 50,
        cacheReadTokens: 1000,
        reasoningTokens: 10,
      },
    ]);
    expect(JSON.stringify(sent)).not.toContain("secret");

    // A new call is read on the next sync; the old one is not sent again.
    const db = new Database(c.path);
    db.query("INSERT INTO gen_metadata VALUES (?, ?)").run(1, call(1_700_000_002_000, "claude-sonnet-4-5"));
    db.close();
    utimesSync(c.path, new Date(), new Date(Date.now() + 5_000));
    sent.length = 0;
    await sync(first.state, { statePath, enabled, send, dirs: { antigravity: [dir] } });
    expect(sent.map((e) => [e.messageId, e.model])).toEqual([["cascade-1:gen:1", "claude-sonnet-4-5"]]);
  });

  test("an older .pb conversation waits while Antigravity is closed", async () => {
    const dir = directory();
    mkdirSync(join(dir, "conversations"), { recursive: true });
    writeFileSync(join(dir, "conversations", "cascade-old.pb"), "encrypted");
    const statePath = join(directory(), "state.json");
    const { sent, send } = collector();
    const errors: unknown[] = [];

    await sync(
      { files: {} },
      { statePath, enabled, send, dirs: { antigravity: [dir] }, onError: (e) => errors.push(e) },
    );
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("no Antigravity folder is not an error", async () => {
    const statePath = join(directory(), "state.json");
    const { sent, send } = collector();
    const errors: unknown[] = [];
    await sync(
      { files: {} },
      {
        statePath,
        enabled,
        send,
        dirs: { antigravity: [join(directory(), "missing")] },
        onError: (e) => errors.push(e),
      },
    );
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });
});
