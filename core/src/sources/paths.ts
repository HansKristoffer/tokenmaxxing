import { Database } from "bun:sqlite";
import { realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { typedSwitch } from "hanzio";

function resolveDir(envValue: string | undefined, fallback: string): string {
  const raw = envValue && envValue.length > 0 ? envValue : fallback;
  const expanded = raw === "~" ? homedir() : raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
  return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded);
}

/** Where desktop apps keep their data: Application Support on a Mac, `~/.config` on Linux. */
const appSupport = () =>
  typedSwitch(
    process.platform,
    {
      darwin: () => join(homedir(), "Library", "Application Support"),
      win32: () => process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
    },
    () => resolveDir(process.env.XDG_CONFIG_HOME, join(homedir(), ".config")),
  );

function claudeCodeProjectsDir(): string {
  // CLAUDE_CONFIG_DIR points at the .claude root; sessions live under projects/
  return join(resolveDir(process.env.CLAUDE_CONFIG_DIR, join(homedir(), ".claude")), "projects");
}

/** Claude Desktop's data dir, which holds Cowork ("local agent mode") transcripts. */
export function claudeCoworkDir(): string {
  return resolveDir(process.env.TOKENMAXXING_CLAUDE_COWORK_DIR, join(appSupport(), "Claude"));
}

/** PostHog Desktop's data dir. Its agent runs Claude Code with `claude/` as the config dir. */
function posthogDesktopDir(): string {
  return resolveDir(
    process.env.TOKENMAXXING_POSTHOG_DESKTOP_DIR,
    join(appSupport(), "@posthog", "posthog-code"),
  );
}

const codexHome = () => resolveDir(process.env.CODEX_HOME, join(homedir(), ".codex"));

export function cursorStateDbPath(): string {
  const dir = resolveDir(process.env.CURSOR_DATA_DIR, join(appSupport(), "Cursor", "User", "globalStorage"));
  return join(dir, "state.vscdb");
}

// The Desktop store has used both names across versions; scan both.
const COWORK_SESSION_ROOTS = ["local-agent-mode-sessions", "claude-code-sessions"] as const;

async function scanGlob(cwd: string, pattern: string, dot = false): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const rel of new Bun.Glob(pattern).scan({ cwd, onlyFiles: true, dot })) {
      out.push(join(cwd, rel));
    }
  } catch {
    // dir missing
  }
  return out;
}

/**
 * Includes `<session>/subagents/agent-*.jsonl`, so subagents are parsed too. PostHog Desktop's
 * sessions are Claude Code sessions in their own config dir, so they count as Claude Code.
 */
export async function listClaudeCodeFiles(): Promise<string[]> {
  const dirs = [claudeCodeProjectsDir(), join(posthogDesktopDir(), "claude", "projects")];
  const groups = await Promise.all([...new Set(dirs)].map((dir) => scanGlob(dir, "**/*.jsonl")));
  return groups.flat();
}

/** Scoped to the session roots so the scan never descends into the multi-GB `vm_bundles/`. */
export async function listClaudeCoworkFiles(): Promise<string[]> {
  const base = claudeCoworkDir();
  const groups = await Promise.all(
    COWORK_SESSION_ROOTS.map((root) => scanGlob(join(base, root), "**/.claude/projects/**/*.jsonl", true)),
  );
  return groups.flat();
}

/**
 * Archiving a thread (CLI, Codex app, ChatGPT app) moves its rollout to `archived_sessions/`. Same
 * file name, so the same message ids: the server drops what it already has from the re-read.
 *
 * `state_*.sqlite` (`threads.rollout_path`) is only a pointer. A rollout that still exists under
 * the Codex home is parsed like any other JSONL, including one that lives outside `sessions/` and
 * `archived_sessions/`. `threads.tokens_used` is a single running total with no per-turn split, so
 * it is not turned into events: billing it next to a rollout would count the same usage twice, and
 * stuffing the aggregate into one bucket would invent a breakdown. Consumer ChatGPT chats that
 * never write a Codex rollout have no local token ledger.
 */
export async function listCodexFiles(): Promise<string[]> {
  const home = codexHome();
  const [live, archived, indexed, posthog] = await Promise.all([
    scanGlob(join(home, "sessions"), "**/*.jsonl"),
    scanGlob(join(home, "archived_sessions"), "**/*.jsonl"),
    listCodexIndexedRollouts(home),
    listPosthogDesktopCodexFiles(),
  ]);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  for (const path of [...live, ...archived]) add(canonical(path) ?? path);
  // Already real paths (`rolloutInsideHome`).
  for (const path of indexed) add(path);
  for (const path of posthog) add(canonical(path) ?? path);
  return out;
}

/**
 * PostHog Desktop gives each Codex task run on its gateway a `codex-home/<taskRunId>` of its own, and
 * keeps only `sessions/` when the run ends. A run on the user's own ChatGPT login uses `~/.codex`.
 */
function listPosthogDesktopCodexFiles(): Promise<string[]> {
  return scanGlob(join(posthogDesktopDir(), "codex-home"), "*/sessions/**/*.jsonl");
}

/** Codex state catalogs. `CODEX_SQLITE_HOME` can put them beside `CODEX_HOME`. */
function codexStateRoots(home: string): string[] {
  const roots = [home, join(home, "sqlite")];
  const extra = process.env.CODEX_SQLITE_HOME;
  if (extra && extra.length > 0) {
    const dir = resolveDir(extra, extra);
    roots.push(dir, join(dir, "sqlite"));
  }
  return roots;
}

/**
 * Rollout JSONL paths recorded in Codex's thread index. Missing files, paths outside the Codex
 * home, and databases without a `threads` table contribute nothing.
 */
async function listCodexIndexedRollouts(home: string): Promise<string[]> {
  const dbPaths = new Set<string>();
  for (const root of codexStateRoots(home)) {
    for (const path of await scanGlob(root, "state_*.sqlite")) dbPaths.add(canonical(path) ?? path);
  }
  const root = canonical(home);
  const out: string[] = [];
  if (root === null) return out;
  for (const dbPath of dbPaths)
    for (const path of rolloutRows(dbPath)) {
      const file = rolloutInsideHome(root, isAbsolute(path) ? path : join(home, path));
      if (file) out.push(file);
    }
  return out;
}

/** Each catalog's `rollout_path`s, kept until the database (or its write-ahead log) changes. */
const catalogs = new Map<string, { version: string; paths: string[] }>();

function rolloutRows(dbPath: string): string[] {
  const version = [dbPath, `${dbPath}-wal`]
    .map((p) => {
      const st = statSync(p, { throwIfNoEntry: false });
      return st ? `${st.mtimeMs}:${st.size}` : "-";
    })
    .join(" ");
  const kept = catalogs.get(dbPath);
  if (kept?.version === version) return kept.paths;
  let db: Database | undefined;
  try {
    db = new Database(dbPath, { readonly: true });
    const rows = db.query("SELECT rollout_path FROM threads").all() as { rollout_path: unknown }[];
    const paths = rows.flatMap((row) =>
      typeof row.rollout_path === "string" && row.rollout_path.length > 0 ? [row.rollout_path] : [],
    );
    catalogs.set(dbPath, { version, paths });
    return paths;
  } catch {
    // Locked, missing, or an older catalog with no threads table. Session globs still count.
    return [];
  } finally {
    db?.close();
  }
}

/** Real path of a `.jsonl` file that stays inside `root` (the real Codex home) after resolving symlinks. */
function rolloutInsideHome(root: string, candidate: string): string | null {
  if (!candidate.endsWith(".jsonl")) return null;
  const file = canonical(candidate);
  if (file === null) return null;
  const rel = relative(root, file);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return file;
}

function canonical(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}
