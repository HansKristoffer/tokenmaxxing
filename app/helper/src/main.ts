import { homedir } from "node:os";
import { join } from "node:path";
import type { Command, Message } from "@tokenmaxxing/core/protocol.ts";
import { loadState } from "@tokenmaxxing/core/sync/state.ts";
import { sync } from "@tokenmaxxing/core/sync/sync.ts";
import { SOURCES } from "@tokenmaxxing/core/types.ts";
import pkg from "../../../package.json" with { type: "json" };
import { Helper } from "./helper.ts";

const stateDir =
  process.env.TOKENMAXXING_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Tokenmaxxing");
const statePath = join(stateDir, "state.json");

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
  const started = Date.now();
  const r = await sync(await loadState(statePath), {
    statePath,
    enabled: new Set(SOURCES),
    onError: (err, where) => console.error(`${where}: ${String(err)}`),
    send: async (events) => {
      const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/ingest`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) throw new Error(`ingest failed: ${res.status} ${await res.text()}`);
      return (await res.json()) as { inserted: number; duplicates: number };
    },
  });
  console.log(JSON.stringify({ sent: r.sent, inserted: r.inserted, ms: Date.now() - started }));
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
