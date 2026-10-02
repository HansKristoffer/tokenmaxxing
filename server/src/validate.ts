import { type MessageType, SOURCES, type Source, type TokenEvent } from "@tokenmaxxing/core/types.ts";
import { CHAT_MAX_LENGTH } from "@tokenmaxxing/core/world.ts";

/** Lowercase handle, 2–32 chars. Shown to other users, so no free-form text. */
const NAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function parseUserName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return NAME_RE.test(name) ? name : null;
}

/** Company names are display-only (React escapes them); trimmed, 1–32 chars, no control chars. */
export function parseCompanyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  if (name.length < 1 || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

/** A website as its bare host (`acme.com`), from `acme.com`, `https://www.acme.com/about`, etc. */
export function parseWebsite(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 256) return null;
  const text = raw.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    // A registrable name with a TLD: no IPs, no `localhost`, no user:pass@ or ports.
    if (url.username || url.password || url.port) return null;
    return /^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Chat text is shown to everyone in the room (React escapes it); control chars become spaces. */
export function parseChatText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control chars is the point
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text.length >= 1 && text.length <= CHAT_MAX_LENGTH ? text : null;
}

export const MAX_EVENTS_PER_REQUEST = 1000;
/** Clock-skew headroom for events stamped slightly in the future. */
const MAX_FUTURE_MS = 3_600_000;
const MAX_ID_LENGTH = 256;
/**
 * No real turn comes near this (a whole context window is a few million), and it keeps sums far
 * from SQLite's 64-bit limit: `SUM` throws past it, which would break every leaderboard at once.
 */
export const MAX_TOKENS_PER_EVENT = 1_000_000_000;
/**
 * Model names are shown on profiles, so they can't carry free text. Real ones look like
 * `claude-opus-4-7`, `us.anthropic.claude-sonnet-4:0`, `claude-opus-4@20250514` or `<synthetic>`;
 * anything else is counted as `unknown` rather than dropped.
 */
const MODEL_RE = /^[\w.:/@<>+-]{1,128}$/;

const isNonNegInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isTokens = (v: unknown): v is number => isNonNegInt(v) && v <= MAX_TOKENS_PER_EVENT;
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
  if (e.messageType !== "user" && e.messageType !== "assistant" && e.messageType !== "pr")
    return "messageType";
  if (typeof e.model !== "string" || e.model.length > MAX_ID_LENGTH) return "model";
  if (e.messageType === "assistant" && e.model.length === 0) return "model";
  for (const k of ["inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens"] as const) {
    if (!isTokens(e[k])) return k;
  }
  if (e.reasoningTokens !== null && !isTokens(e.reasoningTokens)) return "reasoningTokens";
  if (
    e.costCents !== undefined &&
    e.costCents !== null &&
    (e.source !== "cursor_local" ||
      typeof e.costCents !== "number" ||
      !Number.isFinite(e.costCents) ||
      e.costCents < 0 ||
      e.costCents > 100_000_000)
  )
    return "costCents";
  return {
    ...(e.costCents !== undefined ? { costCents: e.costCents as number | null } : {}),
    source: e.source as Source,
    sessionId: e.sessionId,
    agentId: (e.agentId as string | null | undefined) ?? null,
    messageId: e.messageId,
    requestId: e.requestId as string | null,
    timestamp: e.timestamp,
    model: e.model === "" || MODEL_RE.test(e.model) ? e.model : "unknown",
    messageType: e.messageType as MessageType,
    inputTokens: e.inputTokens as number,
    outputTokens: e.outputTokens as number,
    cacheCreationTokens: e.cacheCreationTokens as number,
    cacheReadTokens: e.cacheReadTokens as number,
    reasoningTokens: e.reasoningTokens as number | null,
  };
}
