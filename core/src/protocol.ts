/**
 * Menu bar shell ↔ helper protocol: newline-delimited JSON over the helper's
 * stdin/stdout. The Swift side mirrors these shapes in `Protocol.swift`; the
 * contract test (app/helper/test/protocol.test.ts) writes a fixture the Swift
 * test decodes, so drift fails CI on both sides.
 */
import type { Reaction } from "./moments.ts";
import type { RangeKey } from "./range.ts";
import type { Source } from "./types.ts";

export type SortKey = "tokens" | "parallelism" | "cost" | "prs";

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
  | { id: number; cmd: "installUpdate" }
  | { id: number; cmd: "sendMessage"; groupId: number; text: string }
  | { id: number; cmd: "deleteMessage"; momentId: number }
  /** Toggles my reaction. */
  | { id: number; cmd: "react"; momentId: number; emoji: string }
  /** While open, the helper refreshes `chat.timeline` for `groupId` every few seconds. */
  | { id: number; cmd: "setChatOpen"; open: boolean; groupId: number | null };

export type Message =
  | { id: number; ok: true; result: unknown }
  /** Stable codes: name_taken, invalid_name, not_found, group_full, rate_limited, offline, … */
  | { id: number; ok: false; error: string }
  | { event: "state"; state: AppState }
  /** After signUp → save to Keychain. `null` → the token was rejected; delete it. */
  | { event: "token"; token: string | null }
  /** Show a macOS notification (already worded and capped by the helper). */
  | { event: "notify"; title: string; body: string };

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
  prs: number;
  /** The person ranked just above me, and the gap in the current sort's unit. */
  above: { name: string; gap: number } | null;
  /** Rank change over the last hour (today only). */
  delta: number | null;
  /** Yesterday's title emoji, e.g. ["👑"]. */
  titles: string[];
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  tokens: number;
  costUsd: number;
  parallelism: number | null;
  peakAgents: number;
  prs: number;
  isMe: boolean;
  titles: string[];
  delta: number | null;
  level: number;
}

export interface Progress {
  level: number;
  levelTitle: string;
  lifetimeTokens: number;
  /** Days won 👑 in the last 30. */
  daysWon30: number;
  winStreak: number;
  activeStreak: number;
  /** Emoji of unlocked achievements, oldest first. */
  achievements: string[];
}

export interface ChatItem {
  id: number;
  /** Empty for system lines (race moments). */
  author: string;
  text: string;
  isMe: boolean;
  isSystem: boolean;
  createdAt: number;
  reactions: Reaction[];
}

export interface ChatState {
  open: boolean;
  groupId: number | null;
  /** The open group's latest items, oldest first. */
  timeline: ChatItem[];
  /** Chat messages from others I haven't seen. */
  unread: number;
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
  progress: Progress | null;
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
  chat: ChatState;
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
  github: "GitHub PRs",
};

export const LEADERBOARD_TOP = 10;
