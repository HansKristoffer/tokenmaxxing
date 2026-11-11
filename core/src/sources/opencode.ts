import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type TokenEvent, tokenEvent } from "../types.ts";

/**
 * OpenCode keeps every session in SQLite under its XDG data folder (on macOS too):
 * `opencode.db`, or `opencode-<channel>.db` for a non-stable channel.
 */
export const opencodeDataDir = (): string =>
  join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode");

const DB_NAME = /^opencode(-[\w.-]+)?\.db$/;

export function opencodeDbPaths(dir = opencodeDataDir()): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => DB_NAME.test(f))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/** Where a table's last read stopped: rows sort by `time_updated`, then `id`. */
export interface OpencodeCursor {
  updatedAt: number;
  id: string;
}

/**
 * The tables messages live in. OpenCode 1.x wrote `message` (`role`, `modelID`); 2.x writes
 * `session_message` (`type`, `model.id`) and can still have older sessions in `message`. A message
 * migrated into both keeps its id, so the server stores it once.
 */
const TABLES = {
  message: {
    type: "json_extract(data, '$.role')",
    model: "json_extract(data, '$.modelID')",
    where: "1",
  },
  session_message: {
    type: "type",
    model: "json_extract(data, '$.model.id')",
    where: "type IN ('user', 'assistant')",
  },
} as const;
export type OpencodeTable = keyof typeof TABLES;

/** Rows read at once, so a first sync of a long history goes out in bounded batches. */
const PAGE = 5000;

interface Row {
  id: string;
  session: string;
  updatedAt: number;
  createdAt: number;
  type: string | null;
  model: string | null;
  created: number | null;
  completed: number | null;
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

const count = (n: number | null) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

/**
 * A finished message as an event, or null. An assistant message still streaming has no
 * `time.completed`; its row is updated when it finishes, so the next read after it picks it up.
 * OpenCode's `input` excludes cache reads and writes, and its `output` excludes reasoning, which
 * is added back: every other source reports output with reasoning in it.
 */
function toEvent(r: Row): TokenEvent | null {
  const timestamp = count(r.created) || r.createdAt;
  const base = { source: "opencode", sessionId: r.session, messageId: r.id, timestamp } as const;
  if (r.type === "user") return tokenEvent({ ...base, messageType: "user" });
  if (r.type !== "assistant" || !r.completed) return null;
  const reasoning = count(r.reasoning);
  const e = tokenEvent({
    ...base,
    messageType: "assistant",
    model: r.model || "unknown",
    inputTokens: count(r.input),
    outputTokens: count(r.output) + reasoning,
    cacheCreationTokens: count(r.cacheWrite),
    cacheReadTokens: count(r.cacheRead),
    reasoningTokens: reasoning,
  });
  // An aborted or failed request that used no tokens.
  return e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens > 0 ? e : null;
}

/**
 * One table's messages updated after `from`, a page at a time, each with where it stopped. Only
 * ids, times, model names and token counts are read: message content never leaves SQLite.
 */
export function* readOpencodeTable(
  db: Database,
  table: OpencodeTable,
  from: OpencodeCursor | undefined,
): Generator<{ events: TokenEvent[]; cursor: OpencodeCursor }> {
  const t = TABLES[table];
  const query = db.query<Row, [number, number, string]>(
    `SELECT id, session_id AS session, time_updated AS updatedAt, time_created AS createdAt,
       ${t.type} AS type, ${t.model} AS model,
       json_extract(data, '$.time.created') AS created,
       json_extract(data, '$.time.completed') AS completed,
       json_extract(data, '$.tokens.input') AS input,
       json_extract(data, '$.tokens.output') AS output,
       json_extract(data, '$.tokens.reasoning') AS reasoning,
       json_extract(data, '$.tokens.cache.read') AS cacheRead,
       json_extract(data, '$.tokens.cache.write') AS cacheWrite
     FROM ${table}
     WHERE ${t.where} AND (time_updated > ?1 OR (time_updated = ?2 AND id > ?3))
     ORDER BY time_updated, id
     LIMIT ${PAGE}`,
  );
  let cursor = from ?? { updatedAt: -1, id: "" };
  for (;;) {
    const rows = query.all(cursor.updatedAt, cursor.updatedAt, cursor.id);
    if (rows.length === 0) return;
    const last = rows.at(-1)!;
    cursor = { updatedAt: last.updatedAt, id: last.id };
    yield { events: rows.map(toEvent).filter((e) => e !== null), cursor };
    if (rows.length < PAGE) return;
  }
}

/** The message tables this database has, oldest layout first. */
export function opencodeTables(db: Database): OpencodeTable[] {
  const names = new Set(
    db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name),
  );
  return (Object.keys(TABLES) as OpencodeTable[]).filter((t) => names.has(t));
}

export const openOpencodeDb = (path: string): Database => {
  const db = new Database(path, { readonly: true });
  // OpenCode may be writing; wait for it rather than failing the sync.
  db.exec("PRAGMA busy_timeout = 2000");
  return db;
};
