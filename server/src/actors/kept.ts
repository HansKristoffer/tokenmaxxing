/**
 * What an actor keeps between wakes: one plain object, held in `c.vars` and written to the actor's own
 * SQLite as JSON. It replaces RivetKit's `c.state`, which RivetKit 3 deprecates: that saved the whole
 * object about once a second, and handed it out behind a proxy that made every read a trap.
 *
 * A row holds one top-level key, or, under a key named in `byEntry` (`world`'s players), one entry: a
 * save writes the rows that changed, not the object. Which those are, `save` works out by comparing each
 * row's JSON with what it last wrote. That costs a `JSON.stringify` of the object for every save, and
 * nothing that changes the object has to say so.
 *
 * So the object holds only what JSON does: no `Infinity`, `Map`, `Date` or bigint (`unkeepable`).
 *
 * No RivetKit in here: `migrate/export.ts` runs on RivetKit 2 and writes these rows too.
 */
import type { Sql, TxSql } from "./shared.ts";

/** Run in each actor's `onMigrate`. */
export const KEPT_TABLE =
  "CREATE TABLE IF NOT EXISTS kept (name TEXT PRIMARY KEY, json TEXT NOT NULL) WITHOUT ROWID";

/** The keys each actor keeps a row per entry for, by actor name. */
export const KEPT_BY_ENTRY: Record<string, readonly string[]> = { world: ["players"] };

/** Rows in one statement: two parameters each, far under SQLite's limit. */
const BATCH = 200;

/** `value` as rows, by name. A key or an entry that is `undefined` has no row, as JSON has no `undefined`. */
export function keptRows(value: object, byEntry: readonly string[] = []): Map<string, string> {
  const rows = new Map<string, string>();
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    // Read back, a row named `a/b` is the entry `b` under `a`.
    if (key.includes("/")) throw new Error(`kept: the key ${key} has a slash`);
    if (!byEntry.includes(key)) rows.set(key, JSON.stringify(v));
    else
      for (const [entry, e] of Object.entries(v as object))
        if (e !== undefined) rows.set(`${key}/${entry}`, JSON.stringify(e));
  }
  return rows;
}

/**
 * Where `value` holds something JSON would change or drop (`players.4.x`), or null. An `undefined` in an
 * object is fine: read back, the key is missing, which every reader of an optional key already takes. So
 * is `-0`, which comes back as `0`.
 */
export function unkeepable(value: unknown, path = ""): string | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : path;
  if (typeof value !== "object") return path;
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const bad = v === undefined ? `${path}.${i}` : unkeepable(v, `${path}.${i}`);
      if (bad !== null) return bad;
    }
    return null;
  }
  // A `Date`, a `Map`, a typed array: JSON makes something else of each.
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return path;
  for (const [k, v] of Object.entries(value)) {
    const bad = v === undefined ? null : unkeepable(v, path ? `${path}.${k}` : k);
    if (bad !== null) return bad;
  }
  return null;
}

export class Kept<T extends object> {
  /** Each row's JSON as last written. */
  private readonly written: Map<string, string>;
  /** A save asked for that hasn't started: whoever asks before it does shares it. */
  private queued: Promise<void> | null = null;
  private tail: Promise<void> = Promise.resolve();

  private constructor(
    readonly value: T,
    private readonly db: TxSql,
    private readonly byEntry: readonly string[],
    written: Map<string, string>,
  ) {
    this.written = written;
  }

  /**
   * What `db` has kept, or `fresh()` when it has kept nothing (written by the first `save`). Without
   * `fresh`, nothing kept is an error: an actor made with its input (`Kept.create`) always has rows.
   */
  static async load<T extends object>(
    db: TxSql,
    byEntry: readonly string[] = [],
    fresh?: () => T,
  ): Promise<Kept<T>> {
    const rows = (await db.execute("SELECT name, json FROM kept")) as { name: string; json: string }[];
    if (rows.length === 0) {
      if (!fresh) throw new Error("kept: nothing was kept for this actor");
      return new Kept(fresh(), db, byEntry, new Map());
    }
    const value: Record<string, unknown> = {};
    for (const { name, json } of rows) {
      const slash = name.indexOf("/");
      if (slash < 0) value[name] = JSON.parse(json);
      else {
        const key = name.slice(0, slash);
        value[key] ??= {};
        (value[key] as Record<string, unknown>)[name.slice(slash + 1)] = JSON.parse(json);
      }
    }
    // With no entries there are no rows to say the key was there.
    for (const key of byEntry) value[key] ??= {};
    return new Kept(value as T, db, byEntry, new Map(rows.map((r) => [r.name, r.json])));
  }

  /** Writes a new actor's first `value`, in its `onCreate`: `load` reads it back. */
  static async create(db: Sql, value: object, byEntry: readonly string[] = []): Promise<void> {
    await upsert(db, [...keptRows(value, byEntry)]);
  }

  /**
   * Writes what changed since the last save; resolves when it is on disk. Saves run one at a time, and a
   * save that hasn't started yet covers every change made until it does.
   */
  save(): Promise<void> {
    if (this.queued) return this.queued;
    const run = this.tail.then(() => {
      this.queued = null;
      return this.write();
    });
    this.queued = run;
    this.tail = run.catch(() => {});
    return run;
  }

  private async write(): Promise<void> {
    const rows = keptRows(this.value, this.byEntry);
    const changed: [string, string][] = [];
    for (const row of rows) if (this.written.get(row[0]) !== row[1]) changed.push(row);
    const gone = [...this.written.keys()].filter((name) => !rows.has(name));
    if (changed.length === 0 && gone.length === 0) return;
    await this.db.transaction(
      async (tx) => {
        await upsert(tx, changed);
        for (let i = 0; i < gone.length; i += BATCH) {
          const names = gone.slice(i, i + BATCH);
          await tx.execute(`DELETE FROM kept WHERE name IN (${names.map(() => "?").join(", ")})`, ...names);
        }
      },
      { name: "keep" },
    );
    for (const [name, json] of changed) this.written.set(name, json);
    for (const name of gone) this.written.delete(name);
  }
}

async function upsert(db: Sql, rows: [string, string][]): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.execute(
      `INSERT INTO kept (name, json) VALUES ${batch.map(() => "(?, ?)").join(", ")}
       ON CONFLICT (name) DO UPDATE SET json = excluded.json`,
      ...batch.flat(),
    );
  }
}

type Definition = { config: { actions?: Record<string, unknown> } };

/**
 * Makes every action of `definition` save before it answers, in place: what an action changed is on disk
 * when its caller hears of it, and after one that threw halfway, the disk still matches the memory. For
 * actors whose object is small; `world` saves from its loop instead.
 */
export function saveAfterActions(definition: Definition): void {
  const actions = definition.config.actions ?? {};
  for (const [name, handler] of Object.entries(actions)) {
    if (typeof handler !== "function") continue;
    actions[name] = async (c: { vars: { kept: Kept<object> } }, ...args: unknown[]) => {
      try {
        return await handler(c, ...args);
      } finally {
        await c.vars.kept.save();
      }
    };
  }
}
