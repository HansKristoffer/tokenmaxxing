import { expect, test } from "bun:test";
import type { AppState, Message } from "@tokenmaxxing/core/protocol.ts";

/**
 * Contract fixture: every field of every protocol message the Swift shell
 * decodes. CI runs this before `swift test`, whose ProtocolTests decode the
 * file, so a shape change on either side fails the build.
 */
const state: AppState = { phase: "ready", version: "1.2.3" };

const messages: Message[] = [
  { event: "state", state },
  { event: "state", state: { ...state, phase: "onboarding" } },
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
