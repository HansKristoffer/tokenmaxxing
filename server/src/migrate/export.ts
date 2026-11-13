/**
 * Reads every actor out of RivetKit 2's store: `bun export.ts <engine port> <frames> [page]`, started by
 * `from-v2.ts` with RIVETKIT_STORAGE_PATH on that store. Frames go to the file `frames` (a FIFO the
 * importer reads), a line of JSON each. `page` is how many actors the engine is asked for at a time.
 */

import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { actor, setup } from "rivetkit-v2";
import { createClient } from "rivetkit-v2/client";
import { db } from "rivetkit-v2/db";
import { KEPT_BY_ENTRY, KEPT_TABLE, keptRows, unkeepable } from "../actors/kept.ts";
import { ACTORS, again, type Courier, courier, type Frame, framesOf, take, walk } from "./courier.ts";

const [port, frames, page = "100"] = process.argv.slice(2);
if (!port || !frames) throw new Error("usage: export.ts <engine port> <frames> [page]");
const TOKEN = "default";
const endpoint = `http://127.0.0.1:${port}`;

const out = createWriteStream(frames);
const write = async (f: Frame) => {
  if (!out.write(`${JSON.stringify(f)}\n`)) await once(out, "drain");
};

const registry = setup({
  use: Object.fromEntries(ACTORS.map((name) => [name, courier({ actor, db } as never, true)])) as never,
  startEngine: true,
  token: TOKEN,
  engineHost: "127.0.0.1",
  enginePort: Number(port),
  startServices: false,
  noWelcome: true,
  logging: { level: "error" },
  shutdown: { gracePeriodMs: 5_000, disableSignalHandlers: true },
});
registry.start();
await registry.startAndWait();
const client = createClient({ endpoint, token: TOKEN, disableMetadataLookup: true }) as unknown as Record<
  string,
  { getForId(id: string): Courier }
>;

const text = (s: string) => `'${s.replaceAll("'", "''")}'`;

/**
 * An actor's state as the table `Kept` reads on RivetKit 3, row for row what its first save there would
 * write; how many rows. A state JSON would change stops the move here, with the old town untouched:
 * better than an actor that wakes on RivetKit 3 to something else than it kept.
 */
async function keep(name: string, key: string, state: unknown): Promise<number> {
  if (state === undefined || state === null) return 0;
  const bad = unkeepable(state);
  if (bad !== null) throw new Error(`${name} ${key} keeps ${bad || "a state"} that JSON can't hold`);
  // In the table's own order (by name, as bytes): the importer's digest reads them back in it.
  const rows = [...keptRows(state as object, KEPT_BY_ENTRY[name])]
    .sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .map(([row, json]) => `(${text(row)},${text(json)})`);
  if (rows.length === 0) return 0;
  await write({ t: "ddl", sql: [KEPT_TABLE] });
  const sha = createHash("sha256");
  for (const r of rows) sha.update(r).update("\n");
  for (const frame of framesOf("kept", ["name", "json"], rows)) await write(frame);
  await write({ t: "table", table: "kept", count: rows.length, sha: sha.digest("hex") });
  return rows.length;
}

/** Everything one actor keeps, as frames; how many rows that was. */
async function dump(name: string, key: string, actor: Courier): Promise<number> {
  await again(() => actor.state());
  let rows = await keep(name, key, take());
  const tables = await again(() => actor.tables());
  await write({ t: "ddl", sql: tables.map((t) => t.sql) });
  for (const t of tables) {
    const sent = await walk(actor, t, async (page) => {
      for (const frame of framesOf(t.name, t.columns, page)) await write(frame);
    });
    await write({ t: "table", table: t.name, ...sent });
    rows += sent.count;
  }
  const { ddl, ...counters } = await again(() => actor.extras());
  await write({ t: "ddl", sql: ddl });
  await write({ t: "counters", ...counters });
  return rows;
}

interface Listed {
  actors: { actor_id: string; key: string | null; destroy_ts: number | null }[];
  pagination?: { cursor?: string | null };
}

let actors = 0;
for (const name of ACTORS) {
  const seen = new Set<string>();
  for (let cursor = ""; ;) {
    const url = `${endpoint}/actors?namespace=default&name=${name}&limit=${page}${cursor && `&cursor=${encodeURIComponent(cursor)}`}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`listing ${name}: ${res.status} ${await res.text()}`);
    const listed = (await res.json()) as Listed;
    for (const a of listed.actors) {
      if (a.destroy_ts !== null || seen.has(a.actor_id)) continue;
      seen.add(a.actor_id);
      // Ours are one part each ("main", a user's id, a match's): more parts would need RivetKit's own escaping.
      if (!a.key || /[/\\]/.test(a.key)) throw new Error(`${name} ${a.actor_id} has the key ${a.key}`);
      await write({ t: "actor", name, key: a.key });
      const rows = await dump(name, a.key, client[name]!.getForId(a.actor_id));
      await write({ t: "done", name, key: a.key, rows });
      actors++;
    }
    const next = listed.pagination?.cursor ?? "";
    if (listed.actors.length === 0 || !next || next === cursor) break;
    cursor = next;
  }
}
await write({ t: "end", actors });
out.end();
await once(out, "finish");
await registry.shutdown().catch(() => {});
process.exit(0);
