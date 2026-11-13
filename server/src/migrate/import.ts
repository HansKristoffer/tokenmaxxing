/**
 * Writes every actor into RivetKit 3's store: `bun import.ts <engine port> <frames>`, started by
 * `from-v2.ts` with RIVETKIT_STORAGE_PATH on that store, which must be empty. Each actor is created under
 * its old name and key, as a courier (`courier.ts`), and given what the exporter read. Exits 0 only if
 * every actor the exporter counted arrived and read back the same.
 */
import { actor, setup } from "rivetkit";
import { createClient } from "rivetkit/client";
import { db } from "rivetkit/db";
import { ACTORS, again, type Courier, courier, type Frame, mail, walk } from "./courier.ts";

const [port, frames] = process.argv.slice(2);
if (!port || !frames) throw new Error("usage: import.ts <engine port> <frames>");
const TOKEN = "default";

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
const client = createClient({
  endpoint: `http://127.0.0.1:${port}`,
  token: TOKEN,
  disableMetadataLookup: true,
}) as unknown as Record<string, { create(key: string[]): Promise<Courier> }>;

async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of stream) {
    const parts = (rest + decoder.decode(chunk, { stream: true })).split("\n");
    rest = parts.pop()!;
    yield* parts;
  }
  if (rest) yield rest;
}

/**
 * Gives a new, empty actor one frame. A `table` frame is checked against what was just written: a
 * difference throws, and the migration stops.
 */
async function load(to: Courier, f: Frame): Promise<void> {
  if (f.t === "ddl") await to.run(f.sql);
  else if (f.t === "rows") {
    mail.carried = f.rows;
    await to.insert(f.table, f.columns);
  } else if (f.t === "table") {
    const t = (await again(() => to.tables())).find((x) => x.name === f.table);
    if (!t) throw new Error(`no table ${f.table}`);
    const got = await walk(to, t);
    if (got.count !== f.count || got.sha !== f.sha)
      throw new Error(
        `${f.table}: ${got.count} rows arrived (${got.sha.slice(0, 12)}), ${f.count} were sent (${f.sha.slice(0, 12)})`,
      );
  } else if (f.t === "counters") await to.setCounters(f);
  else throw new Error(`a ${f.t} frame is not for an actor`);
}

let into: Courier | null = null;
let actors = 0;
let rows = 0;
let sent: number | null = null;
// How far it is, every half minute it got further: `from-v2.ts` takes a long silence for a move that is stuck.
let framesRead = 0;
let told = 0;
setInterval(() => {
  if (framesRead === told) return;
  told = framesRead;
  console.log(`[migrate] ${actors} actors and ${rows} rows moved`);
}, 30_000).unref();
for await (const line of lines(Bun.file(frames).stream())) {
  const f = JSON.parse(line) as Frame;
  framesRead++;
  if (f.t === "actor") into = await client[f.name]!.create([f.key]);
  else if (f.t === "done") {
    into = null;
    actors++;
    rows += f.rows;
  } else if (f.t === "end") sent = f.actors;
  else {
    if (!into) throw new Error(`a ${f.t} frame outside an actor`);
    await load(into, f);
  }
}
// The exporter died halfway: its `end` never came.
if (sent === null || into) throw new Error("the export stopped before its end");
if (sent !== actors) throw new Error(`${actors} actors arrived, ${sent} were sent`);
await registry.shutdown();
console.log(JSON.stringify({ migrated: { actors, rows } }));
process.exit(0);
