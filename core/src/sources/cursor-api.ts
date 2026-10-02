import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { CURSOR_API_MESSAGE_PREFIX, type TokenEvent, tokenEvent } from "../types.ts";

const URL = "https://cursor.com/api/dashboard/get-filtered-usage-events";
const PAGE_SIZE = 100;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export interface CursorCredentials {
  accountId: string;
  cookie: string;
}

/** Same local JWT → dashboard cookie approach as c-johannesen/cursorbar. */
export function loadCursorCredentials(dbPath: string): CursorCredentials {
  let db: Database | undefined;
  try {
    db = new Database(dbPath, { readonly: true });
    const row = db.query("SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'").get() as {
      value: string;
    } | null;
    const jwt = row?.value;
    if (typeof jwt !== "string" || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(jwt)) throw new Error();
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString());
    const userId = typeof payload.sub === "string" ? payload.sub.split("|").at(-1) : undefined;
    if (!userId || !/^[\w-]+$/.test(userId)) throw new Error();
    return { accountId: hash(userId), cookie: `WorkosCursorSessionToken=${userId}%3A%3A${jwt}` };
  } catch {
    // SQLite and JSON errors can contain sensitive values; never forward those errors.
    throw new Error("Cursor credentials unavailable. Open Cursor and sign in to sync usage.");
  } finally {
    db?.close();
  }
}

export interface CursorApiOptions {
  dbPath: string;
  /** Re-read overlapping windows: Cursor may publish usage after the request completed. */
  since: number;
  until: number;
  expectedAccountId?: string;
  fetch?: typeof globalThis.fetch;
  credentials?: () => CursorCredentials;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Cursor usage response.");
  }
  return value as Record<string, unknown>;
}

function count(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Cursor token count.");
  }
  return value;
}

/** Only token metadata leaves this module. No response bodies or credentials are persisted. */
export async function fetchCursorUsage(opts: CursorApiOptions): Promise<{
  events: TokenEvent[];
  accountId: string;
}> {
  const load = opts.credentials ?? (() => loadCursorCredentials(opts.dbPath));
  let credentials = load();
  const accountId = credentials.accountId;
  if (opts.expectedAccountId && opts.expectedAccountId !== accountId) {
    throw new Error("Cursor account changed during sync. Try syncing again.");
  }
  const request = opts.fetch ?? globalThis.fetch;
  const events: TokenEvent[] = [];
  const occurrences = new Map<string, number>();
  for (let page = 1; page <= 1000; page++) {
    const getPage = () =>
      request(URL, {
        method: "POST",
        redirect: "error",
        headers: {
          Cookie: credentials.cookie,
          Origin: "https://cursor.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: String(opts.since),
          endDate: String(opts.until),
          page,
          pageSize: PAGE_SIZE,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    let response: Response;
    try {
      response = await getPage();
      if (response.status === 401) {
        credentials = load();
        if (credentials.accountId !== accountId) throw new Error();
        response = await getPage();
      }
    } catch {
      throw new Error("Cursor usage request failed. Try syncing again.");
    }
    if (!response.ok) throw new Error(`Cursor usage API returned HTTP ${response.status}.`);
    let data: Record<string, unknown>;
    try {
      data = record(await response.json());
    } catch {
      throw new Error("Invalid Cursor usage response.");
    }
    const rows = data.usageEventsDisplay;
    const total = count(data.totalUsageEventsCount);
    if (!Array.isArray(rows) || typeof data.totalUsageEventsCount !== "number") {
      throw new Error("Invalid Cursor usage response.");
    }
    const expectedRows = Math.min(PAGE_SIZE, Math.max(0, total - (page - 1) * PAGE_SIZE));
    if (rows.length < expectedRows || rows.length > PAGE_SIZE) {
      throw new Error("Incomplete Cursor usage response.");
    }
    for (const raw of rows) {
      const row = record(raw);
      // Older request-based plans can have no token breakdown; don't fabricate tokens.
      if (row.tokenUsage === null || row.tokenUsage === undefined) continue;
      const usage = record(row.tokenUsage);
      if (
        !["inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"].some(
          (key) => usage[key] !== undefined && usage[key] !== null,
        )
      )
        continue;
      const timestamp = typeof row.timestamp === "string" ? Number(row.timestamp) : row.timestamp;
      if (
        typeof timestamp !== "number" ||
        !Number.isSafeInteger(timestamp) ||
        timestamp <= 0 ||
        typeof row.model !== "string" ||
        !row.model
      )
        throw new Error("Invalid Cursor usage event.");
      if (timestamp < opts.since || timestamp > opts.until) continue;
      const tokens = {
        inputTokens: count(usage.inputTokens),
        outputTokens: count(usage.outputTokens),
        cacheCreationTokens: count(usage.cacheWriteTokens),
        cacheReadTokens: count(usage.cacheReadTokens),
      };
      // Dashboard rows don't always expose an ID. A metadata hash survives page shifts,
      // restarts, retries, and multiple devices; identical rows retain their multiplicity.
      const key = hash(
        JSON.stringify([
          accountId,
          timestamp,
          row.model,
          row.kind ?? null,
          row.conversationId ?? null,
          tokens,
        ]),
      );
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      const id = `${CURSOR_API_MESSAGE_PREFIX}${key}:${occurrence}`;
      events.push(
        tokenEvent({
          source: "cursor_local",
          sessionId:
            typeof row.conversationId === "string" && row.conversationId
              ? row.conversationId
              : `cursor:${accountId}`,
          messageId: id,
          timestamp,
          model: row.model,
          messageType: "assistant",
          ...tokens,
        }),
      );
    }
    if (page * PAGE_SIZE >= total) return { events, accountId };
  }
  throw new Error("Cursor usage pagination limit reached; sync state was not advanced.");
}
