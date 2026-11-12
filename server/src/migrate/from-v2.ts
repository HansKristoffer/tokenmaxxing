/**
 * The move from RivetKit 2 to RivetKit 3. RivetKit 3's engine keeps its data in a store of its own
 * (`engine/depot`) and does not read RivetKit 2's (`engine/db`): started on a volume that only has the old
 * one, it comes up as an empty town. So the first start on RivetKit 3 copies every actor across, before
 * anything is served:
 *
 * - `export.ts` runs on RivetKit 2 (the `rivetkit-v2` dependency) with its engine on the old store, and
 *   reads each actor's state and tables through a courier (`courier.ts`).
 * - `import.ts` runs on RivetKit 3 with its engine on the new store, creates each actor again under the
 *   same name and key, and writes what the exporter read. Every table is read back and its digest
 *   compared, and the state too.
 *
 * The old store is never written to by us and stays where it is: a start of the previous release still
 * finds the town as it was when it moved. A copy that fails leaves no new store, so the next start tries
 * again from the beginning; one that succeeds leaves `MARKER`, and is never run again.
 *
 * ponytail: delete this folder, the `rivetkit-v2` dependency and the old store (`engine/db`, `.rivetkit-v2`)
 * once production has moved.
 */
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stopEngine } from "../engine.ts";

const engineDir = (storage: string) => join(storage, ".rivetkit/var/engine");
/** Written when every actor has moved. */
export const MARKER = "migrated-from-v2.json";
/** There while a move runs: a new store next to it is ours, half made, and can go. */
const UNDERWAY = "migrating-from-v2";
/** The import says how far it is every half minute it gets further. This long without a word, it is stuck. */
const STALL_MS = 15 * 60_000;
/** RivetKit 2's engine listens this far from ours while it is read (each engine also takes +1 and +10). */
const V2_PORT_OFFSET = 20;

export interface Migrated {
  actors: number;
  rows: number;
  ms: number;
}

/** Whether `storage` holds a town that RivetKit 3 has not been given yet. */
export const pending = (storage: string): boolean =>
  existsSync(join(engineDir(storage), "db/CURRENT")) && !existsSync(join(engineDir(storage), MARKER));

/** Moves every actor in `storage` to RivetKit 3's store; null if there is nothing to move. Throws if it fails. */
export async function migrateFromV2(
  storage: string,
  enginePort: number,
  /** How many actors the old engine is asked for at a time. */
  page = 100,
): Promise<Migrated | null> {
  if (!pending(storage)) return null;
  const started = performance.now();
  const dir = engineDir(storage);
  // RivetKit 2 on a root of its own, so the two don't share `runtime.json` and logs: only its store is the old one.
  const old = join(storage, ".rivetkit-v2");
  const frames = join(old, "frames");
  const clean = () => {
    // Half a town is worse than none: the next start copies it all again.
    for (const left of ["depot", "config.json"]) rmSync(join(dir, left), { recursive: true, force: true });
    rmSync(frames, { force: true });
  };
  // A new store that no move of ours left behind is someone's town on RivetKit 3: never deleted from here.
  if (existsSync(join(dir, "depot")) && !existsSync(join(dir, UNDERWAY)))
    throw new Error(
      `${dir} has RivetKit 2's store (db) and a RivetKit 3 store (depot) this move didn't make, and no ${MARKER}. ` +
        `If the town in depot is the one to keep, write {} to ${MARKER}; if it is the one in db, delete depot.`,
    );
  writeFileSync(join(dir, UNDERWAY), `${new Date().toISOString()}\n`);
  clean();
  mkdirSync(join(old, ".rivetkit/var/engine"), { recursive: true });
  const link = join(old, ".rivetkit/var/engine/db");
  if (!existsSync(link)) symlinkSync(join(dir, "db"), link);
  if (Bun.spawnSync(["mkfifo", frames]).exitCode !== 0) throw new Error(`mkfifo ${frames} failed`);

  const run = (script: string, root: string, port: number, ...args: string[]) =>
    Bun.spawn(["bun", join(import.meta.dir, script), String(port), frames, ...args], {
      // Without TCP_NODELAY every call to an actor waits ~40 ms on a delayed ACK, and a big table is thousands.
      env: { ...process.env, RIVETKIT_STORAGE_PATH: root, RIVET__GUARD__TCP_NODELAY: "true" },
      stdout: "pipe",
      stderr: "inherit",
    });
  const v2Port = enginePort + V2_PORT_OFFSET;
  const reader = run("import.ts", storage, enginePort);
  const writer = run("export.ts", old, v2Port, String(page));
  const said = { reader: "", writer: "" };
  let heardAt = Date.now();
  const listen = async (who: keyof typeof said, out: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of out) {
      const text = decoder.decode(chunk, { stream: true });
      said[who] = (said[who] + text).slice(-4_000);
      if (who === "reader") heardAt = Date.now();
      process.stdout.write(text);
    }
  };
  const heard = Promise.all([listen("reader", reader.stdout), listen("writer", writer.stdout)]);
  // `/health` says "migrating" for as long as this runs: a move that hangs must end, so the host starts it again.
  const stalled = setInterval(() => {
    if (Date.now() - heardAt < STALL_MS) return;
    console.error(`[migrate] nothing from the import in ${STALL_MS / 60_000} minutes: stopping it`);
    reader.kill("SIGKILL");
  }, 30_000);
  try {
    // Whichever stops first: if it failed, the other is waiting on a pipe nobody holds any more.
    const first = await Promise.race([
      reader.exited.then((code) => ({ who: "import", code })),
      writer.exited.then((code) => ({ who: "export", code })),
    ]);
    if (first.code !== 0) throw new Error(`the ${first.who} stopped with code ${first.code}`);
    const [read, wrote] = await Promise.all([reader.exited, writer.exited]);
    if (read !== 0 || wrote !== 0) throw new Error(`import ended with ${read}, export with ${wrote}`);
    await heard;
    const result = /\{"migrated":\{"actors":(\d+),"rows":(\d+)\}\}/.exec(said.reader);
    if (!result) throw new Error("the import didn't say what it moved");
    const done: Migrated = {
      actors: Number(result[1]),
      rows: Number(result[2]),
      ms: Math.round(performance.now() - started),
    };
    await Promise.all([stopEngine(enginePort), stopEngine(v2Port)]);
    writeFileSync(join(dir, MARKER), `${JSON.stringify({ ...done, at: new Date().toISOString() })}\n`);
    rmSync(join(dir, UNDERWAY), { force: true });
    rmSync(frames, { force: true });
    return done;
  } catch (err) {
    reader.kill("SIGKILL");
    writer.kill("SIGKILL");
    await Promise.all([reader.exited, writer.exited]);
    await Promise.all([stopEngine(enginePort), stopEngine(v2Port)]);
    clean();
    throw err;
  } finally {
    clearInterval(stalled);
  }
}
