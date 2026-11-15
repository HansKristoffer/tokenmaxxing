import { readdirSync, readFileSync } from "node:fs";

/** Sends `signal` to `pid`; false if it's gone. Signal 0 only asks whether it's there. */
const send = (pid: number, signal: NodeJS.Signals | 0) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
};

/** What a command printed, or nothing if this machine doesn't have it. */
const output = (cmd: string[]): string => {
  try {
    return Bun.spawnSync(cmd).stdout.toString();
  } catch {
    return "";
  }
};

interface Engine {
  pid: number;
  parent: number;
  /** The port its gateway listens on, where that can be read. */
  port: number | null;
}

/** Every engine process on this machine. From `/proc` on Linux: the server image has neither `ps` nor `lsof`. */
function engines(): Engine[] {
  // macOS has no /proc, so `ps` is the only listing. It doesn't report the gateway port.
  if (process.platform !== "linux") {
    const lines = output(["ps", "-A", "-o", "pid=,ppid=,command="]).split("\n");
    return lines.flatMap((line) => {
      const m = /^(\d+)\s+(\d+)\s+(.*)$/.exec(line.trim());
      if (!m?.[3]?.includes("rivet-engine")) return [];
      return [{ pid: Number(m[1]), parent: Number(m[2]), port: null }];
    });
  }

  const found: Engine[] = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (!readFileSync(`/proc/${entry}/cmdline`, "utf8").includes("rivet-engine")) continue;

      // The command may hold spaces and parentheses, so the fields start after its last ")":
      // state, then the parent's pid.
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const afterCommand = stat.slice(stat.lastIndexOf(")") + 2);
      const parent = Number(afterCommand.split(" ")[1]);

      // RivetKit passes the gateway port to the engine as one environment variable.
      const environ = readFileSync(`/proc/${entry}/environ`, "utf8");
      const port = /(?:^|\0)RIVET__GUARD__PORT=(\d+)\0/.exec(environ);
      found.push({ pid: Number(entry), parent, port: port ? Number(port[1]) : null });
    } catch {
      // The process exited while it was read, or belongs to another user and can't be read.
    }
  }
  return found;
}

/**
 * RivetKit starts the engine as a child in its own process group, so it doesn't die with this
 * process: it would be left running (and holding its port and data dir) after an exit. Only engines
 * that are direct children of this process, or that listen on `port`, are touched.
 */
export function engineChildren(port?: number): number[] {
  const all = engines();
  const pids = all.filter((e) => e.parent === process.pid).map((e) => e.pid);
  // An engine left by a server that was SIGKILLed is no child of ours, but a restart reuses it:
  // the one listening on our engine port.
  if (port) {
    const listening =
      process.platform === "linux"
        ? all.filter((e) => e.port === port).map((e) => e.pid)
        : output(["lsof", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"])
            .split("\n")
            .map(Number)
            .filter((pid) => all.some((e) => e.pid === pid));
    for (const pid of listening) if (!pids.includes(pid)) pids.push(pid);
  }
  return pids;
}

/** SIGTERM the engine, SIGKILL whatever is still there after `graceMs`. */
export async function stopEngine(port?: number, graceMs = 3_000) {
  const pids = engineChildren(port);
  for (const pid of pids) send(pid, "SIGTERM");

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline && pids.some((pid) => send(pid, 0))) await Bun.sleep(50);

  for (const pid of pids) if (send(pid, 0)) send(pid, "SIGKILL");
}
