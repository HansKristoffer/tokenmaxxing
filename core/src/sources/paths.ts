import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

function resolveDir(envValue: string | undefined, fallback: string): string {
  const raw = envValue && envValue.length > 0 ? envValue : fallback;
  const expanded = raw === "~" ? homedir() : raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
  return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded);
}

/** Where desktop apps keep their data: Application Support on a Mac, `~/.config` on Linux. */
const appSupport = () =>
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : resolveDir(process.env.XDG_CONFIG_HOME, join(homedir(), ".config"));

function claudeCodeProjectsDir(): string {
  // CLAUDE_CONFIG_DIR points at the .claude root; sessions live under projects/
  return join(resolveDir(process.env.CLAUDE_CONFIG_DIR, join(homedir(), ".claude")), "projects");
}

/** Claude Desktop's data dir, which holds Cowork ("local agent mode") transcripts. */
export function claudeCoworkDir(): string {
  return resolveDir(process.env.TOKENMAXXING_CLAUDE_COWORK_DIR, join(appSupport(), "Claude"));
}

const codexHome = () => resolveDir(process.env.CODEX_HOME, join(homedir(), ".codex"));

export function cursorStateDbPath(): string {
  const dir = resolveDir(process.env.CURSOR_DATA_DIR, join(appSupport(), "Cursor", "User", "globalStorage"));
  return join(dir, "state.vscdb");
}

export function cursorProjectsDir(): string {
  return resolveDir(process.env.CURSOR_PROJECTS_DIR, join(homedir(), ".cursor", "projects"));
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

/** Includes `<session>/subagents/agent-*.jsonl`, so subagents are parsed too. */
export function listClaudeCodeFiles(): Promise<string[]> {
  return scanGlob(claudeCodeProjectsDir(), "**/*.jsonl");
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
 */
export async function listCodexFiles(): Promise<string[]> {
  const home = codexHome();
  const [live, archived] = await Promise.all([
    scanGlob(join(home, "sessions"), "**/*.jsonl"),
    scanGlob(join(home, "archived_sessions"), "**/*.jsonl"),
  ]);
  return [...live, ...archived];
}

export function listCursorTranscriptFiles(): Promise<string[]> {
  return scanGlob(cursorProjectsDir(), "**/agent-transcripts/**/*.jsonl");
}
