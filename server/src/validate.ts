import type { SortKey } from "@tokenmaxxing/core/protocol.ts";
import { isRangeKey, type RangeKey } from "@tokenmaxxing/core/range.ts";
import { type MessageType, SOURCES, type Source, type TokenEvent } from "@tokenmaxxing/core/types.ts";

/** Lowercase handle, 2–32 chars. Shown to other users, so no free-form text. */
export const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function parseUserName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

/** Group names are display-only (React escapes them); trimmed, 1–48 chars, no control chars. */
export function parseGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  if (name.length < 1 || name.length > 48 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

export const MAX_EVENTS_PER_REQUEST = 1000;
/** Clock-skew headroom for events stamped slightly in the future. */
const MAX_FUTURE_MS = 86_400_000;
const MAX_ID_LENGTH = 256;

const isNonNegInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID_LENGTH;

/** Returns the event, or a reason string. Nothing from the payload is echoed back. */
export function parseEvent(raw: unknown, now: number): TokenEvent | string {
  if (!raw || typeof raw !== "object") return "not an object";
  const e = raw as Record<string, unknown>;
  if (!SOURCES.includes(e.source as Source)) return "source";
  if (!isId(e.sessionId)) return "sessionId";
  if (e.agentId !== null && e.agentId !== undefined && !isId(e.agentId)) return "agentId";
  if (!isId(e.messageId)) return "messageId";
  if (e.requestId !== null && !isId(e.requestId)) return "requestId";
  if (!isNonNegInt(e.timestamp) || e.timestamp > now + MAX_FUTURE_MS) return "timestamp";
  if (e.messageType !== "user" && e.messageType !== "assistant") return "messageType";
  if (typeof e.model !== "string" || e.model.length > MAX_ID_LENGTH) return "model";
  if (e.messageType === "assistant" && e.model.length === 0) return "model";
  for (const k of ["inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens"] as const) {
    if (!isNonNegInt(e[k])) return k;
  }
  if (e.reasoningTokens !== null && !isNonNegInt(e.reasoningTokens)) return "reasoningTokens";
  return {
    source: e.source as Source,
    sessionId: e.sessionId,
    agentId: (e.agentId as string | null | undefined) ?? null,
    messageId: e.messageId,
    requestId: e.requestId as string | null,
    timestamp: e.timestamp,
    model: e.model,
    messageType: e.messageType as MessageType,
    inputTokens: e.inputTokens as number,
    outputTokens: e.outputTokens as number,
    cacheCreationTokens: e.cacheCreationTokens as number,
    cacheReadTokens: e.cacheReadTokens as number,
    reasoningTokens: e.reasoningTokens as number | null,
  };
}

export const parseRange = (raw: string | undefined): RangeKey =>
  raw !== undefined && isRangeKey(raw) ? raw : "7d";

export const parseSort = (raw: string | undefined): SortKey =>
  raw === "parallelism" || raw === "cost" ? raw : "tokens";

/** `Date#getTimezoneOffset()` minutes; clamped to real-world offsets. */
export function parseTz(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= -840 && n <= 720 ? n : 0;
}

export function parseId(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}
