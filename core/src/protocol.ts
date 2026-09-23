/**
 * Menu bar shell ↔ helper protocol: newline-delimited JSON over the helper's
 * stdin/stdout. The Swift side mirrors these shapes in `Protocol.swift`; the
 * contract test (app/helper/test/protocol.test.ts) writes a fixture the Swift
 * test decodes, so drift fails CI on both sides.
 */
import type { RangeKey } from "./range.ts";
import type { Source } from "./types.ts";

export type SortKey = "tokens" | "parallelism" | "cost";

export interface View {
  range: RangeKey;
  groupId: number | null;
  sort: SortKey;
}

export type Command =
  | {
      id: number;
      cmd: "init";
      /** From the Keychain; sent over stdin so it never shows up in `ps`. */
      token: string | null;
      serverUrl: string;
      view: View;
      enabledSources: Source[];
    }
  | { id: number; cmd: "signUp"; name: string }
  | { id: number; cmd: "rename"; name: string }
  | { id: number; cmd: "createGroup"; name: string }
  | { id: number; cmd: "joinGroup"; code: string }
  | { id: number; cmd: "leaveGroup"; groupId: number }
  | { id: number; cmd: "rotateCode"; groupId: number }
  | { id: number; cmd: "setView"; view: View }
  | { id: number; cmd: "setSources"; enabledSources: Source[] }
  | { id: number; cmd: "syncNow" }
  | { id: number; cmd: "refresh" }
  /** Replies with `{ url }`: the dashboard, signed in via a single-use code. */
  | { id: number; cmd: "openDashboard" }
  | { id: number; cmd: "signOut" }
  /** Starts `brew upgrade` (the app quits and relaunches), or replies `{ url }` to download manually. */
  | { id: number; cmd: "installUpdate" };

export type Message =
  | { id: number; ok: true; result: unknown }
  /** Stable codes: name_taken, invalid_name, not_found, group_full, rate_limited, offline, … */
  | { id: number; ok: false; error: string }
  | { event: "state"; state: AppState }
  /** After signUp → save to Keychain. `null` → the token was rejected; delete it. */
  | { event: "token"; token: string | null };

export interface MeStats {
  name: string;
  /** Rank in the current view; null before the first leaderboard load. */
  rank: number | null;
  of: number;
  tokens: number;
  costUsd: number;
  parallelism: number | null;
  peakAgents: number;
  tokensPerActiveHour: number | null;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  tokens: number;
  costUsd: number;
  parallelism: number | null;
  peakAgents: number;
  isMe: boolean;
}

export interface GroupInfo {
  id: number;
  name: string;
  /** Display form, e.g. `K7QM-2XRP-9D`. */
  code: string;
  memberCount: number;
  isOwner: boolean;
}

export interface SourceInfo {
  id: Source;
  label: string;
  enabled: boolean;
}

export interface AppState {
  phase: "starting" | "onboarding" | "ready";
  version: string;
  view: View;
  me: MeStats | null;
  /** Top of the leaderboard; the shell pins `me` below it when outside. */
  leaderboard: LeaderboardRow[];
  groups: GroupInfo[];
  sync: {
    syncing: boolean;
    lastSyncedAt: number | null;
    lastError: string | null;
    online: boolean;
  };
  sources: SourceInfo[];
  /** A newer published version, or null. */
  update: {
    version: string;
    /** Installed with Homebrew, so the helper can upgrade in place. */
    viaBrew: boolean;
    installing: boolean;
  } | null;
}

export const SOURCE_LABELS: Record<Source, string> = {
  claude_code: "Claude Code",
  claude_cowork: "Claude Cowork",
  codex: "Codex",
  cursor_local: "Cursor",
};

export const LEADERBOARD_TOP = 10;
