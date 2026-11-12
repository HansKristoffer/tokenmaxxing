/**
 * Reads every actor out of RivetKit 2's store: `bun export.ts <engine port> <frames> [page]`, started by
 * `from-v2.ts` with RIVETKIT_STORAGE_PATH on that store. Frames go to the file `frames` (a FIFO the
 * importer reads), a line of JSON each. `page` is how many actors the engine is asked for at a time.
 */

import { serialize } from "bun:jsc";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { actor, setup } from "rivetkit-v2";
import { createClient } from "rivetkit-v2/client";
import { db } from "rivetkit-v2/db";
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
  use: Object.fromEntries(ACTORS.map((name) => [name, courier({ actor, db } as never)])) as never,
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

/** Everything one actor keeps, as frames; how many rows that was. */
async function dump(actor: Courier): Promise<number> {
  await again(() => actor.state());
  await write({ t: "state", v: Buffer.from(serialize(take())).toString("base64") });
  const tables = await again(() => actor.tables());
  await write({ t: "ddl", sql: tables.map((t) => t.sql) });
  let rows = 0;
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
      const rows = await dump(client[name]!.getForId(a.actor_id));
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
