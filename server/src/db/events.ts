import type { TokenEvent } from "@tokenmaxxing/core/types.ts";
import type { Db } from "./db.ts";

/** Duplicates (same user/source/message/request/type) are dropped by the unique index. */
export function insertEvents(
  db: Db,
  user: string,
  events: readonly TokenEvent[],
  now: number,
): { inserted: number; duplicates: number } {
  const stmt = db.query(
    `INSERT OR IGNORE INTO events (user, source, session_id, agent_id, message_id, request_id,
       timestamp, model, message_type, input_tokens, output_tokens, cache_creation_tokens,
       cache_read_tokens, reasoning_tokens, ingested_at)
     VALUES ($user, $source, $sessionId, $agentId, $messageId, $requestId, $timestamp, $model,
       $messageType, $inputTokens, $outputTokens, $cacheCreationTokens, $cacheReadTokens,
       $reasoningTokens, $now)`,
  );
  let inserted = 0;
  db.transaction(() => {
    for (const e of events) {
      inserted += stmt.run({
        user,
        now,
        source: e.source,
        sessionId: e.sessionId,
        agentId: e.agentId,
        messageId: e.messageId,
        requestId: e.requestId,
        timestamp: e.timestamp,
        model: e.model,
        messageType: e.messageType,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        cacheCreationTokens: e.cacheCreationTokens,
        cacheReadTokens: e.cacheReadTokens,
        reasoningTokens: e.reasoningTokens,
      }).changes;
    }
  })();
  return { inserted, duplicates: events.length - inserted };
}
