import { type IngestResponse, SOURCES, type SyncState, type TokenEvent } from "../types.ts";
import { type CollectOptions, collect } from "./collect.ts";
import { saveState } from "./state.ts";

/** Every source is read unless `enabled` narrows it (tests); `gh: null` skips GitHub. */
export interface SyncOptions extends Partial<Pick<CollectOptions, "enabled" | "gh" | "now">> {
  statePath: string;
  send: (events: TokenEvent[]) => Promise<IngestResponse>;
  onError?: (err: unknown, where: string) => void;
}

export interface SyncResult {
  state: SyncState;
  sent: number;
  inserted: number;
}

/** Server rejects bodies above this; batches are split to fit. */
export const MAX_EVENTS_PER_REQUEST = 1000;

/**
 * Read new events and send them. State is saved after every acked batch, so
 * an interrupted first sync resumes where it stopped. A send failure throws
 * with the state up to the last acked batch already persisted.
 */
export async function sync(state: SyncState, opts: SyncOptions): Promise<SyncResult> {
  let sent = 0;
  let inserted = 0;
  const { enabled = new Set(SOURCES), gh, now, onError } = opts;
  for await (const batch of collect(state, { enabled, onError, now, ...(gh !== undefined ? { gh } : {}) })) {
    for (let i = 0; i < batch.events.length; i += MAX_EVENTS_PER_REQUEST) {
      const r = await opts.send(batch.events.slice(i, i + MAX_EVENTS_PER_REQUEST));
      inserted += r.inserted;
    }
    sent += batch.events.length;
    state = batch.commit(state);
    await saveState(opts.statePath, state);
  }
  return { state, sent, inserted };
}
