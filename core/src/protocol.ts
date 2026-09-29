/**
 * Menu bar shell ↔ helper protocol: newline-delimited JSON over the helper's
 * stdin/stdout. The Swift side mirrors these shapes in `Protocol.swift`; the
 * contract test (app/helper/test/protocol.test.ts) writes a fixture the Swift
 * test decodes, so drift fails CI on both sides.
 */
export type Command =
  | {
      id: number;
      cmd: "init";
      /** From the Keychain; sent over stdin so it never shows up in `ps`. */
      token: string | null;
      serverUrl: string;
    }
  | { id: number; cmd: "signUp"; name: string }
  /** Sync now (sent when the Mac wakes). */
  | { id: number; cmd: "syncNow" }
  /** Replies with `{ url }`: the world, signed in via a single-use code. */
  | { id: number; cmd: "openWorld" };

export type Message =
  | { id: number; ok: true; result: unknown }
  /** Stable codes: name_taken, invalid_name, rate_limited, offline, unauthorized, … */
  | { id: number; ok: false; error: string }
  | { event: "state"; state: AppState }
  /** After signUp → save to Keychain. `null` → the token was rejected; delete it. */
  | { event: "token"; token: string | null };

/** The menu bar app is a sign-up form, then just a button that opens the world. */
export interface AppState {
  phase: "starting" | "onboarding" | "ready";
}
