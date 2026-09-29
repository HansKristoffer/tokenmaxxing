import { homedir } from "node:os";
import { join } from "node:path";
import type { Command, Message } from "@tokenmaxxing/core/protocol.ts";
import { loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import { SOURCES } from "@tokenmaxxing/core/types.ts";
import type { registry } from "@tokenmaxxing/server/registry";
import { createClient } from "rivetkit/client";
import pkg from "../../../package.json" with { type: "json" };
import { Helper } from "./helper.ts";

const stateDir =
  process.env.TOKENMAXXING_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Tokenmaxxing");
// v2: the world started from a fresh server, so every Mac re-reads its full history into it.
const statePath = join(stateDir, "state.v2.json");

/** stdout carries protocol messages only; everything else goes to stderr. */
const write = (msg: Message) => process.stdout.write(`${JSON.stringify(msg)}\n`);

if (process.argv.includes("--version")) {
  console.log(pkg.version);
} else if (process.argv.includes("--once")) {
  await runOnce();
} else {
  await serve();
}

/** Headless sync for dogfooding and CI: TOKENMAXXING_TOKEN + TOKENMAXXING_SERVER_URL. */
async function runOnce(): Promise<void> {
  const token = process.env.TOKENMAXXING_TOKEN;
  const serverUrl = process.env.TOKENMAXXING_SERVER_URL;
  if (!token || !serverUrl) {
    console.error("set TOKENMAXXING_TOKEN and TOKENMAXXING_SERVER_URL");
    process.exit(2);
  }
  const client = createClient<typeof registry>({
    endpoint: `${serverUrl.replace(/\/+$/, "")}/api/rivet`,
    disableMetadataLookup: true,
  });
  const player = client.player.get([token.split(".")[0]!], { params: { token } });
  const started = Date.now();
  const r = await sync(await loadState(statePath), {
    statePath,
    enabled: new Set(SOURCES),
    onError: (err, where) => console.error(`${where}: ${String(err)}`),
    send: (events) => player.ingest(events),
  });
  console.log(JSON.stringify({ sent: r.sent, inserted: r.inserted, ms: Date.now() - started }));
  process.exit(0);
}

async function serve(): Promise<void> {
  const helper = new Helper({ statePath, version: pkg.version, write });
  // Bun yields stdin line by line when iterating `console`.
  for await (const raw of console) {
    const line = raw.trim();
    if (!line) continue;
    let cmd: Command;
    try {
      cmd = JSON.parse(line) as Command;
    } catch {
      console.error("ignoring malformed command line");
      continue;
    }
    void helper.handle(cmd);
  }
  // stdin closed: the shell quit or crashed. Exit instead of running orphaned.
  helper.stop();
  process.exit(0);
}
