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
  view: { range: "7d", groupId: 4, sort: "parallelism" },
  me: {
    name: "alice",
    rank: 2,
    of: 12,
    tokens: 123_456_789,
    costUsd: 42.5,
    parallelism: 3.25,
    peakAgents: 7,
    tokensPerActiveHour: 2_400_000,
  },
  leaderboard: [
    {
      rank: 1,
      name: "bob",
      tokens: 200_000_000,
      costUsd: 80.1,
      parallelism: null,
      peakAgents: 1,
      isMe: false,
    },
    {
      rank: 2,
      name: "alice",
      tokens: 123_456_789,
      costUsd: 42.5,
      parallelism: 3.25,
      peakAgents: 7,
      isMe: true,
    },
  ],
  groups: [{ id: 4, name: "Friends", code: "K7QM-2XRP-9D", memberCount: 12, isOwner: true }],
  sync: { syncing: false, lastSyncedAt: 1_790_000_000_000, lastError: null, online: true },
  sources: [{ id: "claude_code", label: "Claude Code", enabled: true }],
  update: { version: "1.3.0", viaBrew: true, installing: false },
};

const messages: Message[] = [
  { event: "state", state },
  {
    event: "state",
    state: { ...state, phase: "onboarding", me: null, leaderboard: [], groups: [], update: null },
  },
  { event: "token", token: "tok_abc" },
  { event: "token", token: null },
  { id: 1, ok: true, result: null },
  { id: 2, ok: true, result: { url: "https://example.com/login?code=x" } },
  { id: 3, ok: false, error: "name_taken" },
];

test("writes the Swift contract fixture", async () => {
  const path = new URL("../../macos/Tests/TokenmaxxingTests/Fixtures/messages.ndjson", import.meta.url)
    .pathname;
  const body = `${messages.map((m) => JSON.stringify(m)).join("\n")}\n`;
  await Bun.write(path, body);
  expect(await Bun.file(path).text()).toBe(body);
});
