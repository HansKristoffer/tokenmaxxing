import { stat } from "node:fs/promises";
import { parseClaudeCodeFile } from "../sources/claude-code.ts";
import { parseCodexFile } from "../sources/codex.ts";
import { type CursorApiOptions, fetchCursorUsage, loadCursorCredentials } from "../sources/cursor-api.ts";
import { fetchPullRequests, type GhRunner, ghPath, ghRunner } from "../sources/github.ts";
import {
  cursorStateDbPath,
  listClaudeCodeFiles,
  listClaudeCoworkFiles,
  listCodexFiles,
} from "../sources/paths.ts";
import type { FileState, Source, SyncState, TokenEvent } from "../types.ts";

/** A file-backed source: list its files, parse one from where the last read stopped. */
interface FileSource {
  id: Source;
  list: () => Promise<string[]>;
  parse: (
    path: string,
    prev: FileState | undefined,
    mtimeMs: number,
  ) => Promise<{ events: TokenEvent[]; next: FileState }>;
}

const claudeParser =
  (source: "claude_code" | "claude_cowork"): FileSource["parse"] =>
  async (path, prev, mtimeMs) => {
    const r = await parseClaudeCodeFile({ path, byteOffset: prev?.byteOffset ?? 0, source });
    return { events: r.events, next: { path, mtimeMs, byteOffset: r.newOffset } };
  };

const FILE_SOURCES: readonly FileSource[] = [
  { id: "claude_code", list: listClaudeCodeFiles, parse: claudeParser("claude_code") },
  { id: "claude_cowork", list: listClaudeCoworkFiles, parse: claudeParser("claude_cowork") },
  {
    id: "codex",
    list: listCodexFiles,
    parse: async (path, prev, mtimeMs) => {
      const r = await parseCodexFile({
        path,
        byteOffset: prev?.byteOffset ?? 0,
        ...(prev?.lastSessionTotals ? { prevSessionTotals: prev.lastSessionTotals } : {}),
        ...(prev?.lastModel ? { prevModel: prev.lastModel } : {}),
      });
      const lastModel = r.lastModel ?? prev?.lastModel;
      return {
        events: r.events,
        next: {
          path,
          mtimeMs,
          byteOffset: r.newOffset,
          lastSessionTotals: r.sessionTotals,
          ...(lastModel ? { lastModel } : {}),
        },
      };
    },
  },
];

const GITHUB_EVERY_MS = 15 * 60_000;
const CURSOR_EVERY_MS = 15 * 60_000;

/** Same key as the server's unique index, so we never send what it would drop. */
const dedupKey = (e: TokenEvent) => `${e.source}\0${e.messageId}\0${e.requestId ?? ""}\0${e.messageType}`;

interface Batch {
  events: TokenEvent[];
  /** Apply to the state only after the server has acked `events`. */
  commit: (state: SyncState) => SyncState;
}

export interface CollectOptions {
  enabled: ReadonlySet<Source>;
  /** Flush a batch once it holds at least this many events. */
  batchSize?: number;
  sources?: readonly FileSource[];
  cursorDbPath?: string;
  cursorFetch?: CursorApiOptions["fetch"];
  cursorCredentials?: () => ReturnType<typeof loadCursorCredentials>;
  /** Runs `gh`; defaults to the installed one. null = no `gh`, skip PRs. */
  gh?: GhRunner | null;
  now?: () => number;
  onError?: (err: unknown, where: string) => void;
}

async function mtimeOf(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Walk every enabled source and yield batches of new events. Reading resumes
 * from the offsets in `state`; each batch's `commit` advances them. A caller
 * that stops early (send failed) just re-reads the same bytes next time.
 */
export async function* collect(state: SyncState, opts: CollectOptions): AsyncGenerator<Batch> {
  const batchSize = opts.batchSize ?? 5000;
  const sources = opts.sources ?? FILE_SOURCES;
  const seen = new Set<string>();
  let events: TokenEvent[] = [];
  let pending: FileState[] = [];

  const take = (evs: TokenEvent[]) => {
    for (const e of evs) {
      const k = dedupKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      events.push(e);
    }
  };
  const flush = (): Batch => {
    const batch = { events, files: pending };
    events = [];
    pending = [];
    return {
      events: batch.events,
      commit: (s) => {
        const files = { ...s.files };
        for (const f of batch.files) files[f.path] = f;
        return { ...s, files };
      },
    };
  };

  const present = new Set<string>();
  for (const source of sources) {
    if (!opts.enabled.has(source.id)) continue;
    let paths: string[] = [];
    try {
      paths = await source.list();
    } catch (err) {
      opts.onError?.(err, `list:${source.id}`);
    }
    for (const path of paths) {
      present.add(path);
      const mtimeMs = await mtimeOf(path);
      if (mtimeMs === null) continue;
      const prev = state.files[path];
      if (prev && mtimeMs <= prev.mtimeMs) continue;
      try {
        const r = await source.parse(path, prev, mtimeMs);
        take(r.events);
        pending.push(r.next);
      } catch (err) {
        opts.onError?.(err, `parse:${path}`);
      }
      if (events.length >= batchSize) yield flush();
    }
  }

  const now = (opts.now ?? Date.now)();
  if (opts.enabled.has("cursor_local") && now - (state.cursorApi?.checkedAt ?? 0) >= CURSOR_EVERY_MS) {
    const dbPath = opts.cursorDbPath ?? cursorStateDbPath();
    if (opts.cursorCredentials || (await mtimeOf(dbPath)) !== null) {
      try {
        const credentials = opts.cursorCredentials ?? (() => loadCursorCredentials(dbPath));
        const accountId = credentials().accountId;
        const since =
          state.cursorApi?.accountId === accountId
            ? Math.max(0, state.cursorApi.checkedAt - 7 * 24 * 60 * 60_000)
            : 0;
        const r = await fetchCursorUsage({
          dbPath,
          since,
          until: now,
          credentials,
          expectedAccountId: accountId,
          fetch: opts.cursorFetch,
        });
        take(r.events);
        const batch = flush();
        yield {
          events: batch.events,
          commit: (s) => ({ ...batch.commit(s), cursorApi: { accountId: r.accountId, checkedAt: now } }),
        };
      } catch (err) {
        opts.onError?.(err, "cursor");
      }
    }
  }

  // PRs change a few times a day, and search has a tight rate limit: ask at most every 15 minutes.
  const checkedAt = state.github?.checkedAt ?? 0;
  if (opts.enabled.has("github") && now - checkedAt >= GITHUB_EVERY_MS) {
    const bin = opts.gh === undefined ? ghPath() : null;
    const gh = opts.gh !== undefined ? opts.gh : bin ? ghRunner(bin) : null;
    if (gh) {
      try {
        const r = await fetchPullRequests(gh, state.github?.since ?? null);
        take(r.events);
        const batch = flush();
        yield {
          events: batch.events,
          commit: (s) => ({ ...batch.commit(s), github: { since: r.since, checkedAt: now } }),
        };
      } catch (err) {
        opts.onError?.(err, "github");
      }
    }
  }

  // Final batch also forgets files that no longer exist on disk.
  const last = flush();
  yield {
    events: last.events,
    commit: (s) => {
      const next = last.commit(s);
      const files: SyncState["files"] = {};
      for (const [path, f] of Object.entries(next.files)) if (present.has(path)) files[path] = f;
      return { ...next, files };
    },
  };
}
