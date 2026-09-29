import { expect, test } from "bun:test";
import type { AppState, Message } from "@tokenmaxxing/core/protocol.ts";

/**
 * Contract fixture: every field of every protocol message the desktop app
 * decodes. CI runs this before `cargo test`, whose helper.rs test decodes the
 * file, so a shape change on either side fails the build.
 */
const state: AppState = {
  phase: "ready",
  today: { tokens: 306_000_000, rank: 2, level: 5 },
  battle: {
    name: "Tokenmaxxing",
    place: 2,
    players: 4,
    tokens: 412_000_000,
    endsAt: 1_790_003_600_000,
    until: 1_790_003_780_000,
  },
};

const messages: Message[] = [
  { event: "state", state },
  { event: "state", state: { phase: "onboarding", today: null, battle: null } },
  { event: "token", token: "12.tok_abc" },
  { event: "token", token: null },
  { id: 1, ok: true, result: null },
  { id: 2, ok: true, result: { code: "12.x" } },
  { id: 3, ok: false, error: "name_taken" },
];

test("writes the desktop app's contract fixture", async () => {
  const path = new URL("../../desktop/src-tauri/tests/fixtures/messages.ndjson", import.meta.url).pathname;
  const body = `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`;
  await Bun.write(path, body);
  expect(await Bun.file(path).text()).toBe(body);
});
