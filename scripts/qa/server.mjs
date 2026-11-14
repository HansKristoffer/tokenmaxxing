// This checkout's QA server (`bun run qa:serve`, `bun run qa:stop`): where its state is kept and who it is.
// Every checkout (the main one and each git worktree) has its own: its own port, data and pid file under
// `.data/qa/`, so two of them run side by side and neither is stopped by the other.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "../..");
/** Git-ignored (`.data/`): the pid file, the server's log, its data and the screenshots. */
export const STATE_DIR = join(ROOT, ".data/qa");
export const STATE_FILE = join(STATE_DIR, "server.json");
/**
 * On the server's command line, so a pid from the pid file can be told from an unrelated process that got
 * the same number, and from another checkout's server.
 */
export const MARK = `--qa=${ROOT}`;

/** What `qa:serve` wrote: `{ pid, port, enginePort, origin, adminToken, storage, log, startedAt }`, or null. */
export function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** Is `pid` this checkout's QA server, still running? */
export function isOurs(pid) {
  if (!pid) return false;
  // `-ww`: the whole command line. The mark is its last argument, so another checkout whose path starts
  // with this one's does not match.
  const ps = Bun.spawnSync(["ps", "-ww", "-p", String(pid), "-o", "args="]);
  return ps.stdout.toString().trim().endsWith(MARK);
}

/** The running QA server's state, or null when there is none (never started, stopped, or it died). */
export function running() {
  const state = readState();
  return state && isOurs(state.pid) ? state : null;
}

/**
 * Where the QA scripts find the game: `QA_ORIGIN` when set (someone else's server, at your own risk), else
 * this checkout's QA server. There is no default port: a guessed one answers with another checkout's game.
 */
export function qaOrigin() {
  if (process.env.QA_ORIGIN) return process.env.QA_ORIGIN;
  const state = running();
  if (state) return state.origin;
  throw new Error("no QA server for this checkout: start one with `bun run qa:serve` (or set QA_ORIGIN)");
}

/** The admin token of the server the scripts talk to (`ADMIN_TOKEN` with `QA_ORIGIN`), or null. */
export const qaAdminToken = () =>
  process.env.QA_ORIGIN ? (process.env.ADMIN_TOKEN ?? null) : (running()?.adminToken ?? null);
