/**
 * What one actor keeps, read out of RivetKit 2's store and written into RivetKit 3's (`from-v2.ts` says
 * why). On RivetKit 2 that was its state and its SQLite tables; on RivetKit 3 it is tables only, and the
 * state arrives as the rows `Kept` reads (`actors/kept.ts`). RivetKit's own tables (`_rivet_*`: schedules,
 * connections, what it was created with) stay behind, and the real actor makes what it needs when it wakes.
 *
 * A courier is an actor with no code of ours: registered under each real actor's name, it reads or writes
 * that actor's data without running its `onWake` or its loop. Every action is one short read or write, so
 * none meets RivetKit's action timeout however big a table is, and a read can be asked again. Rows and
 * state don't go through RivetKit's client (which would encode them, and limits a message's size): actors
 * run in the process that registered them, so an action leaves them in `mail`, or takes them from it.
 */
import { createHash } from "node:crypto";

/** Every actor name the registry has ever had. */
export const ACTORS = ["town", "world", "player", "arcade", "match"] as const;

/** What the exporter writes and the importer reads, a line of JSON each. */
export type Frame =
  | { t: "actor"; name: string; key: string }
  /** Statements to run as they are: tables before their rows, indexes and triggers after. */
  | { t: "ddl"; sql: string[] }
  /** Rows as SQL literals, `(1,'a',NULL)`, written by SQLite's own `quote`. */
  | { t: "rows"; table: string; columns: string[]; rows: string[] }
  /** A table is complete: how many rows, and a digest of them in order. */
  | ({ t: "table"; table: string } & Digest)
  /** AUTOINCREMENT counters (a deleted row's id is never given out again) and `PRAGMA user_version`. */
  | ({ t: "counters" } & Counters)
  | { t: "done"; name: string; key: string; rows: number }
  | { t: "end"; actors: number };

export interface Digest {
  count: number;
  sha: string;
}
interface Counters {
  sequences: { name: string; seq: string }[];
  userVersion: number;
}
export interface Table {
  name: string;
  columns: string[];
  /** Its primary key, for a WITHOUT ROWID table: there is no rowid to walk it by. */
  key: string[] | null;
}

interface Sql {
  execute(sql: string, ...args: unknown[]): Promise<unknown[]>;
}
interface Ctx {
  state: unknown;
  db: Sql;
}

const id = (name: string) => `"${name.replaceAll('"', '""')}"`;
/** Ours, not RivetKit's or SQLite's. */
const OURS = (column: string) =>
  `${column} NOT LIKE '\\_rivet\\_%' ESCAPE '\\' AND ${column} NOT LIKE 'sqlite\\_%' ESCAPE '\\'`;
/** Rows read at a time: each page is a call, and a call is slow next to the rows in it. */
const PAGE = 4_000;
/** Rows in one INSERT: SQLite takes 500 in one VALUES. */
const INSERT_ROWS = 400;
/** A `rows` frame is cut here, however few rows that is. */
const FRAME_BYTES = 256 * 1024;

/** State as plain values: RivetKit hands it out behind a proxy. */
function plain(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(plain);
  if (v instanceof Uint8Array || v instanceof Date || v === null || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
}

/** What an action carries to or from the script that called it, which runs in the same process. */
export const mail: { carried: unknown } = { carried: undefined };
/** Takes what the last action left. */
export function take<T>(): T {
  const v = mail.carried as T;
  mail.carried = undefined;
  return v;
}

// MARK: The actor

const actions = {
  /** Leaves the state in `mail`. On RivetKit 2 only: the courier has none on RivetKit 3. */
  state: (c: Ctx): void => {
    mail.carried = plain(c.state);
  },
  tables: async (c: Ctx): Promise<(Table & { sql: string })[]> => {
    const found = (await c.db.execute(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND ${OURS("name")} ORDER BY rowid`,
    )) as { name: string; sql: string }[];
    const out = [];
    for (const { name, sql } of found) {
      const info = (await c.db.execute(`PRAGMA table_info(${id(name)})`)) as { name: string; pk: number }[];
      const key = info
        .filter((col) => col.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((col) => col.name);
      out.push({
        name,
        sql,
        columns: info.map((col) => col.name),
        key: /WITHOUT\s+ROWID/i.test(sql) ? key : null,
      });
    }
    return out;
  },
  /**
   * Leaves the rows after `after` in `mail`, in order, each as the literal that inserts it again: integers,
   * text, blobs and NULL exactly, a REAL as SQLite prints it (which reads back to the same double). Returns
   * where the next page starts, or null after the last.
   */
  page: async (c: Ctx, t: Table, after: string | null): Promise<string | null> => {
    if (after !== null && !/^-?\d+$/.test(after)) throw new Error(`a page of ${t.name} after ${after}`);
    const literal = `'(' || ${t.columns.map((col) => `quote(${id(col)})`).join(" || ',' || ")} || ')'`;
    const rows = (
      t.key
        ? await c.db.execute(
            `SELECT ${literal} AS r FROM ${id(t.name)} ORDER BY ${t.key.map(id).join(", ")}
             LIMIT ${PAGE} OFFSET ${after ?? 0}`,
          )
        : await c.db.execute(
            `SELECT CAST(rowid AS TEXT) AS k, ${literal} AS r FROM ${id(t.name)}
             WHERE ${after === null ? "1" : `rowid > ${after}`} ORDER BY rowid LIMIT ${PAGE}`,
          )
    ) as { k?: string; r: string }[];
    mail.carried = rows.map((row) => row.r);
    if (rows.length < PAGE) return null;
    return t.key ? String(Number(after ?? 0) + PAGE) : rows.at(-1)!.k!;
  },
  /** Indexes and triggers, and the counters. */
  extras: async (c: Ctx): Promise<{ ddl: string[] } & Counters> => {
    const rest = (await c.db.execute(
      `SELECT sql FROM sqlite_master WHERE type != 'table' AND sql IS NOT NULL
       AND ${OURS("name")} AND ${OURS("tbl_name")} ORDER BY rowid`,
    )) as { sql: string }[];
    // No such table until something is AUTOINCREMENT.
    const has = await c.db.execute("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'");
    const sequences = has.length
      ? ((await c.db.execute(
          `SELECT name, CAST(seq AS TEXT) AS seq FROM sqlite_sequence WHERE ${OURS("name")} ORDER BY name`,
        )) as { name: string; seq: string }[])
      : [];
    const [version] = (await c.db.execute("PRAGMA user_version")) as { user_version: number }[];
    return { ddl: rest.map((r) => r.sql), sequences, userVersion: version?.user_version ?? 0 };
  },

  run: async (c: Ctx, sql: string[]): Promise<void> => {
    for (const statement of sql) await c.db.execute(statement);
  },
  /** Inserts the rows in `mail`. */
  insert: async (c: Ctx, table: string, columns: string[]): Promise<void> => {
    const rows = take<string[]>();
    const into = `INSERT INTO ${id(table)} (${columns.map(id).join(", ")}) VALUES `;
    for (let i = 0; i < rows.length; i += INSERT_ROWS)
      await c.db.execute(into + rows.slice(i, i + INSERT_ROWS).join(","));
  },
  setCounters: async (c: Ctx, { sequences, userVersion }: Counters): Promise<void> => {
    for (const s of sequences) {
      if (!/^-?\d+$/.test(s.seq)) throw new Error(`sequence of ${s.name}: ${s.seq}`);
      // Inserting rows made the row; a table that is empty now, but wasn't always, has none yet.
      await c.db.execute("DELETE FROM sqlite_sequence WHERE name = ?", s.name);
      await c.db.execute(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ${s.seq})`, s.name);
    }
    if (userVersion) await c.db.execute(`PRAGMA user_version = ${Math.trunc(userVersion)}`);
  },
  // `town` on RivetKit 2 has a timer that calls this; the real `town` sweeps when it wakes on RivetKit 3.
  sweep: (): void => {},
};

/** A courier as the scripts call it: each action without its context, answering later. */
export type Courier = {
  [K in keyof typeof actions]: (typeof actions)[K] extends (c: Ctx, ...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/** What the two RivetKits share of `actor()` and `db()`: the courier is defined once, for both. */
interface Kit {
  actor(definition: object): unknown;
  db(): unknown;
}
/** `withState`: on RivetKit 2, where there is state to read. */
export const courier = ({ actor, db }: Kit, withState = false) =>
  actor({ ...(withState ? { state: {} } : {}), db: db(), actions });

// MARK: The scripts' side

/**
 * A read, asked again if it fails: an actor whose engine stopped without warning (a deploy) can take a
 * while to be handed to the new process, and RivetKit's client gives up on it first.
 */
export async function again<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await read();
    } catch (err) {
      if (attempt >= 8) throw err;
      await Bun.sleep(Math.min(15_000, 500 * 2 ** attempt));
    }
  }
}

/** A table's rows from first to last, a page at a time; what they add up to. */
export async function walk(
  actor: Courier,
  t: Table,
  each?: (rows: string[]) => Promise<void>,
): Promise<Digest> {
  const sha = createHash("sha256");
  let count = 0;
  for (let after: string | null = null; ;) {
    const next = await again(async () => {
      const at = await actor.page(t, after);
      return { at, rows: take<string[]>() };
    });
    for (const r of next.rows) sha.update(r).update("\n");
    count += next.rows.length;
    if (next.rows.length) await each?.(next.rows);
    if (next.at === null) return { count, sha: sha.digest("hex") };
    after = next.at;
  }
}

/** `rows` in frames of at most `FRAME_BYTES` (one row is a frame, however big it is). */
export function* framesOf(table: string, columns: string[], rows: string[]): Generator<Frame> {
  for (let from = 0; from < rows.length;) {
    let to = from;
    for (let bytes = 0; to < rows.length && (to === from || bytes + rows[to]!.length <= FRAME_BYTES); to++)
      bytes += rows[to]!.length;
    yield { t: "rows", table, columns, rows: rows.slice(from, to) };
    from = to;
  }
}
