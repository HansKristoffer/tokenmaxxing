/** Reserved message ids for authoritative Cursor dashboard events. */
export const CURSOR_API_MESSAGE_PREFIX = "cursor-api:";

export type Source = "claude_code" | "claude_cowork" | "codex" | "cursor_local" | "grok_bot" | "github";

export const SOURCES: readonly Source[] = [
  "claude_code",
  "claude_cowork",
  "codex",
  "cursor_local",
  "grok_bot",
  "github",
];

/**
 * Cursor dashboard models that belong to Grok Bot, not the Cursor IDE.
 * Matched rows are stored as `grok_bot` with the dashboard's own token counts.
 *
 * The Grok Bot macOS app's `weekly-usage.cache` is plan percent only
 * (`percentUsed`, reset time, plan label). It is not a token ledger and is never
 * read. Grok Bot stays at 0 until the Cursor dashboard returns these rows.
 */
export function isGrokBotModel(model: string): boolean {
  return model === "grok-bot" || model.startsWith("grok-bot-");
}

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

/** Why no PRs can be counted, for the menu: no `gh` (nor a saved git login), or `gh` signed out. */
export type GithubProblem = "no_gh" | "signed_out";

export interface SyncState {
  files: Record<string, FileState>;
  cursorLocal?: { dbPath: string; lastRowid: number };
  cursorApi?: { accountId: string; checkedAt: number; costVersion?: number };
  /**
   * Per GitHub account (`host/login`), the newest PR `createdAt` fetched; when we last asked; and,
   * when no PRs could be counted, why (shown in the menu).
   */
  github?: { cursors?: Record<string, string>; checkedAt?: number; problem?: GithubProblem };
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
