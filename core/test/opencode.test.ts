import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState } from "../src/sync/state.ts";
import { sync } from "../src/sync/sync.ts";
import type { Source, TokenEvent } from "../src/types.ts";

const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(join(tmpdir(), "opencode-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const enabled = new Set<Source>(["opencode"]);
const tokens = { input: 100, output: 20, reasoning: 5, cache: { read: 1000, write: 50 } };

/** An OpenCode 2.x database: older sessions in `message`, new ones in `session_message`. */
function opencodeDb(dir: string, name = "opencode.db") {
  const db = new Database(join(dir, name));
  db.exec(`CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`);
  db.exec(`CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL,
    seq INTEGER NOT NULL, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL)`);
  let seq = 0;
  return {
    db,
    v1: (id: string, updated: number, data: object, session = "ses_a") =>
      db
        .query("INSERT OR REPLACE INTO message VALUES (?, ?, ?, ?, ?)")
        .run(id, session, 1000, updated, JSON.stringify(data)),
    v2: (id: string, type: string, updated: number, data: object, session = "ses_b") =>
      db
        .query("INSERT OR REPLACE INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, session, type, seq++, 2000, updated, JSON.stringify(data)),
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

describe("OpenCode", () => {
  test("reads finished messages from both tables, once, without their content", async () => {
    const dir = directory();
    const { db, v1, v2 } = opencodeDb(dir);
    v1("msg_u1", 10, { role: "user", time: { created: 1500 }, content: "secret prompt" });
    v1("msg_a1", 11, {
      role: "assistant",
      modelID: "claude-sonnet-4-5",
      providerID: "anthropic",
      tokens,
      time: { created: 1600, completed: 1700 },
    });
    // Streaming: no `time.completed` yet.
    v1("msg_a2", 12, { role: "assistant", modelID: "claude-sonnet-4-5", tokens, time: { created: 1800 } });
    // Aborted before any tokens.
    v1("msg_a3", 13, {
      role: "assistant",
      modelID: "claude-sonnet-4-5",
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 1900, completed: 1950 },
    });
    v2("msg_a1", "assistant", 11, {
      model: { providerID: "anthropic", id: "claude-sonnet-4-5" },
      tokens,
      time: { created: 1600, completed: 1700 },
    });
    v2("msg_b1", "assistant", 20, {
      model: { providerID: "openrouter", id: "z-ai/glm-5.3" },
      content: [{ type: "text", text: "secret answer" }],
      tokens,
      time: { created: 2100, completed: 2200 },
    });
    v2("msg_t1", "text", 21, { text: "secret" });
    db.close();

    const { sent, send } = collector();
    const statePath = join(directory(), "sync.json");
    const r = await sync({ files: {} }, { statePath, enabled, send, dirs: { opencode: [dir] } });

    expect(sent.map((e) => [e.messageId, e.messageType, e.model])).toEqual([
      ["msg_u1", "user", ""],
      ["msg_a1", "assistant", "claude-sonnet-4-5"],
      ["msg_b1", "assistant", "z-ai/glm-5.3"],
    ]);
    expect(sent[1]).toMatchObject({
      source: "opencode",
      sessionId: "ses_a",
      timestamp: 1600,
      inputTokens: 100,
      outputTokens: 25,
      reasoningTokens: 5,
      cacheReadTokens: 1000,
      cacheCreationTokens: 50,
    });
    expect(JSON.stringify(sent)).not.toContain("secret");
    expect(r.sent).toBe(3);
    expect(await loadState(statePath)).toMatchObject({
      opencode: {
        [join(dir, "opencode.db")]: {
          message: { updatedAt: 13, id: "msg_a3" },
          // The `text` part after it is not a message, so the checkpoint stays on msg_b1.
          session_message: { updatedAt: 20, id: "msg_b1" },
        },
      },
    });
  });

  test("resumes after the last row, and picks up a message when it finishes", async () => {
    const dir = directory();
    const { db, v1 } = opencodeDb(dir);
    const statePath = join(directory(), "sync.json");
    const streaming = { role: "assistant", modelID: "gpt-5", tokens, time: { created: 1600 } };
    v1("msg_a1", 10, streaming);
    const { sent, send } = collector();
    const first = await sync({ files: {} }, { statePath, enabled, send, dirs: { opencode: [dir] } });
    expect(sent).toHaveLength(0);

    v1("msg_a1", 30, { ...streaming, time: { created: 1600, completed: 1700 } });
    v1("msg_a0", 30, { ...streaming, time: { created: 1500, completed: 1550 } });
    const second = await sync(first.state, { statePath, enabled, send, dirs: { opencode: [dir] } });
    expect(sent.map((e) => e.messageId)).toEqual(["msg_a0", "msg_a1"]);

    await sync(second.state, { statePath, enabled, send, dirs: { opencode: [dir] } });
    expect(sent).toHaveLength(2);
    db.close();
  });

  test("a failed send leaves the checkpoint where it was", async () => {
    const dir = directory();
    const { db, v1 } = opencodeDb(dir);
    v1("msg_a1", 10, { role: "assistant", modelID: "gpt-5", tokens, time: { created: 1, completed: 2 } });
    db.close();
    const statePath = join(directory(), "sync.json");
    const failing = async () => {
      throw new Error("offline");
    };
    await expect(
      sync({ files: {} }, { statePath, enabled, send: failing, dirs: { opencode: [dir] } }),
    ).rejects.toThrow("offline");
    expect((await loadState(statePath)).opencode).toBeUndefined();
    const { sent, send } = collector();
    await sync({ files: {} }, { statePath, enabled, send, dirs: { opencode: [dir] } });
    expect(sent.map((e) => e.messageId)).toEqual(["msg_a1"]);
  });

  test("no OpenCode folder is not an error", async () => {
    const errors: string[] = [];
    const { sent, send } = collector();
    await sync(
      { files: {} },
      {
        statePath: join(directory(), "sync.json"),
        enabled,
        send,
        dirs: { opencode: [join(directory(), "missing")] },
        onError: (_e, where) => errors.push(where),
      },
    );
    expect(sent).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});
