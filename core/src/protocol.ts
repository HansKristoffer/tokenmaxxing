/**
 * Menu bar shell ↔ helper protocol: newline-delimited JSON over the helper's
 * stdin/stdout. The Swift side mirrors these shapes in `Protocol.swift`; the
 * contract test (app/helper/test/protocol.test.ts) writes a fixture the Swift
 * test decodes, so drift fails CI on both sides.
 */
import type { Source } from "./types.ts";

export type Command =
  | {
      id: number;
      cmd: "init";
      /** From the Keychain; sent over stdin so it never shows up in `ps`. */
      token: string | null;
      serverUrl: string;
      enabledSources: Source[];
    }
  | { id: number; cmd: "signUp"; name: string }
  | { id: number; cmd: "setSources"; enabledSources: Source[] }
  | { id: number; cmd: "syncNow" }
  /** Reloads `me` and the mini leaderboard (sent when the menu opens). */
  | { id: number; cmd: "refresh" }
  /** Replies with `{ url }`: the world, signed in via a single-use code. */
  | { id: number; cmd: "openWorld" }
  | { id: number; cmd: "signOut" }
  /** Starts `brew upgrade` (the app quits and relaunches), or replies `{ url }` to download manually. */
  | { id: number; cmd: "installUpdate" };

export type Message =
  | { id: number; ok: true; result: unknown }
  /** Stable codes: name_taken, invalid_name, rate_limited, offline, unauthorized, … */
  | { id: number; ok: false; error: string }
  | { event: "state"; state: AppState }
  /** After signUp → save to Keychain. `null` → the token was rejected; delete it. */
  | { event: "token"; token: string | null };

export interface MeStats {
  name: string;
  /** World rank today by tokens; null before any tokens today. */
  rank: number | null;
  tokensToday: number;
  level: number;
  levelTitle: string;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  company: string | null;
  tokens: number;
  level: number;
  isMe: boolean;
}

export interface SourceInfo {
  id: Source;
  label: string;
  enabled: boolean;
}

export interface AppState {
  phase: "starting" | "onboarding" | "ready";
  version: string;
  me: MeStats | null;
  /** Today's world top 10 by tokens, with me appended when I'm outside it. */
  leaderboard: LeaderboardRow[];
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
  github: "GitHub PRs",
};

export const LEADERBOARD_TOP = 10;
