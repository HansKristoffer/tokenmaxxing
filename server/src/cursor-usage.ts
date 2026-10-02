import { dayKey } from "@tokenmaxxing/core/range.ts";
import {
  CURSOR_API_MESSAGE_PREFIX,
  CURSOR_EXCLUDED_MODELS,
  type TokenEvent,
} from "@tokenmaxxing/core/types.ts";
import type { Sql } from "./actors/shared.ts";

const authoritative = (e: TokenEvent) =>
  e.source === "cursor_local" &&
  e.messageType === "assistant" &&
  e.messageId.startsWith(CURSOR_API_MESSAGE_PREFIX);

/** In the ingest transaction: actual usage replaces estimates for that world day.
 * Older clients may still sync estimates, so reject those once a day has API data.
 * Keep earlier days and zero-token user messages; only covered estimates are replaced.
 */
export async function reconcileCursorUsage(sql: Sql, events: TokenEvent[]): Promise<TokenEvent[]> {
  events = events.filter((e) => e.source !== "cursor_local" || !CURSOR_EXCLUDED_MODELS.has(e.model));
  const days = new Set(events.filter(authoritative).map((e) => dayKey(e.timestamp)));
  for (const day of days) {
    await sql.execute(
      "DELETE FROM events WHERE source = 'cursor_local' AND message_type = 'assistant' AND day = ? AND message_id NOT LIKE ?",
      day,
      `${CURSOR_API_MESSAGE_PREFIX}%`,
    );
  }
  const legacyDays = new Set(
    events
      .filter((e) => e.source === "cursor_local" && e.messageType === "assistant" && !authoritative(e))
      .map((e) => dayKey(e.timestamp)),
  );
  for (const day of legacyDays) {
    if (days.has(day)) continue;
    const existing = await sql.execute(
      "SELECT 1 FROM events WHERE source = 'cursor_local' AND day = ? AND message_id LIKE ? LIMIT 1",
      day,
      `${CURSOR_API_MESSAGE_PREFIX}%`,
    );
    if (existing.length) days.add(day);
  }
  return events.filter(
    (e) =>
      e.source !== "cursor_local" ||
      e.messageType !== "assistant" ||
      authoritative(e) ||
      !days.has(dayKey(e.timestamp)),
  );
}
