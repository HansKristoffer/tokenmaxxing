/** Reserved message ids for authoritative Cursor dashboard events. */
export const CURSOR_API_MESSAGE_PREFIX = "cursor-api:";
/** Cursor background automation is excluded from personal usage. */
export const CURSOR_AUTOMATION_MODEL = "grok-bot-automation";

export type Source = "claude_code" | "claude_cowork" | "codex" | "cursor_local" | "github";

export const SOURCES: readonly Source[] = ["claude_code", "claude_cowork", "codex", "cursor_local", "github"];

/** `pr` marks a pull request the user created (GitHub source, zero tokens). */
export type MessageType = "user" | "assistant" | "pr";

/** One model turn read from a local log. Never carries message content. */
export interface TokenEvent {
  source: Source;
  sessionId: string;
  /** Subagent id within a session (Claude Code `agentId`); null for the main agent. */
  agentId: string | null;
  messageId: string;
  requestId: string | null;
  timestamp: number;
  model: string;
  /** User events carry zero tokens; they exist only for message counts. */
  messageType: MessageType;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number | null;
  /** Cursor-reported request cents, used only when no model price matches. */
  costCents?: number | null;
}

export interface IngestResponse {
  inserted: number;
  duplicates: number;
}

export interface FileState {
  path: string;
  mtimeMs: number;
  byteOffset: number;
  /** Lines fully parsed in a Cursor transcript JSONL (stable message ids). */
  transcriptLineIndex?: number;
  /** Codex only: cumulative totals at the end of the last read. */
  lastSessionTotals?: {
    sessionId: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteInputTokens: number;
    reasoningTokens: number;
  };
  /** Codex only: model in effect at the end of the last read, carried into the next one. */
  lastModel?: string;
}

export interface SyncState {
  files: Record<string, FileState>;
  cursorLocal?: { dbPath: string; lastRowid: number };
  cursorApi?: { accountId: string; checkedAt: number; costVersion?: number };
  /** Newest PR `createdAt` fetched from GitHub, and when we last asked. */
  github?: { since: string | null; checkedAt?: number };
}

/** An event with only what's given: no tokens, no agent, request or model unless set. */
export const tokenEvent = (
  e: Pick<TokenEvent, "source" | "sessionId" | "messageId" | "timestamp" | "messageType"> &
    Partial<TokenEvent>,
): TokenEvent => ({
  agentId: null,
  requestId: null,
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  reasoningTokens: null,
  ...e,
});
