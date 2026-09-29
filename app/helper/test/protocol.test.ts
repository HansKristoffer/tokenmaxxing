import { expect, test } from "bun:test";
import type { AppState, Message } from "@tokenmaxxing/core/protocol.ts";

/**
 * Contract fixture: every field of every protocol message the Swift shell
 * decodes. CI runs this before `swift test`, whose ProtocolTests decode the
 * file, so a shape change on either side fails the build.
 */
const state: AppState = {
  phase: "ready",
  version: "1.2.3",
  me: { name: "alice", rank: 2, tokensToday: 123_456_789, level: 5, levelTitle: "Subagent Shepherd" },
  leaderboard: [
    { rank: 1, name: "bob", company: "Arox", tokens: 200_000_000, level: 6, isMe: false },
    { rank: 2, name: "alice", company: null, tokens: 123_456_789, level: 5, isMe: true },
  ],
  sync: { syncing: false, lastSyncedAt: 1_790_000_000_000, lastError: null, online: true },
  sources: [{ id: "claude_code", label: "Claude Code", enabled: true }],
  battle: {
    matchId: 7,
    name: "Tokenmaxxing",
    place: 2,
    players: 4,
    tokens: 412_000_000,
    startsAt: 1_790_000_000_000,
    endsAt: 1_790_003_600_000,
    until: 1_790_003_780_000,
  },
  update: { version: "1.3.0", viaBrew: true, installing: false },
};

const messages: Message[] = [
  { event: "state", state },
  {
    event: "state",
    state: { ...state, phase: "onboarding", me: null, leaderboard: [], battle: null, update: null },
  },
  { event: "state", state: { ...state, me: { ...state.me!, rank: null, tokensToday: 0 } } },
  { event: "token", token: "12.tok_abc" },
  { event: "token", token: null },
  { id: 1, ok: true, result: null },
  { id: 2, ok: true, result: { url: "https://example.com/#code=12.x" } },
  { id: 3, ok: false, error: "name_taken" },
];

test("writes the Swift contract fixture", async () => {
  const path = new URL("../../macos/Tests/TokenmaxxingTests/Fixtures/messages.ndjson", import.meta.url)
    .pathname;
  const body = `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`;
  await Bun.write(path, body);
  expect(await Bun.file(path).text()).toBe(body);
});
