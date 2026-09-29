import { homedir } from "node:os";
import { join } from "node:path";
import type { Command, Message } from "@tokenmaxxing/core/protocol.ts";
import { Helper } from "./helper.ts";

const stateDir =
  process.env.TOKENMAXXING_STATE_DIR ?? join(homedir(), "Library", "Application Support", "Tokenmaxxing");
// v2: the world started from a fresh server, so every Mac re-reads its full history into it.
const statePath = join(stateDir, "state.v2.json");

/** stdout carries protocol messages only; everything else goes to stderr. */
const write = (msg: Message) => process.stdout.write(`${JSON.stringify(msg)}\n`);

if (process.argv.includes("--once")) await runOnce();
else await serve();

/**
 * Headless sync for dogfooding: TOKENMAXXING_TOKEN + TOKENMAXXING_SERVER_URL. It keeps its own read
 * positions per server, so it never moves the installed app's forward.
 */
async function runOnce(): Promise<void> {
  const token = process.env.TOKENMAXXING_TOKEN;
  const serverUrl = process.env.TOKENMAXXING_SERVER_URL;
  if (!token || !serverUrl) {
    console.error("set TOKENMAXXING_TOKEN and TOKENMAXXING_SERVER_URL");
    process.exit(2);
  }
  const helper = new Helper({
    statePath: join(stateDir, `once-${new URL(serverUrl).host}.json`),
    write: () => {},
  });
  const started = Date.now();
  await helper.handle({ id: 1, cmd: "init", token, serverUrl });
  await helper.syncOnce();
  helper.stop();
  console.log(JSON.stringify({ phase: helper.state.phase, ms: Date.now() - started }));
  process.exit(helper.state.phase === "ready" ? 0 : 1);
}

async function serve(): Promise<void> {
  const helper = new Helper({ statePath, write });
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
