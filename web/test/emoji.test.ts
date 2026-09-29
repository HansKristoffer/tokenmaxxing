import { expect, test } from "bun:test";
import { emojiOnly } from "../src/game/emoji.ts";

test("emoji-only lines burst; anything with words stays a bubble", () => {
  expect(emojiOnly("🚀")).toEqual(["🚀"]);
  expect(emojiOnly(" 🔥 🔥 ")).toEqual(["🔥", "🔥"]);
  // Skin tones, ZWJ sequences and flags are one emoji each.
  expect(emojiOnly("👍🏽🧑‍💻🇩🇰")).toEqual(["👍🏽", "🧑‍💻", "🇩🇰"]);
  expect(emojiOnly("Ship it 🚢")).toBeNull();
  expect(emojiOnly("1️⃣")).toBeNull();
  expect(emojiOnly("")).toBeNull();
  expect(emojiOnly("🎉".repeat(9))).toBeNull();
});
