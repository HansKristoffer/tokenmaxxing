import { expect, test } from "bun:test";
import { seasonAt } from "../src/seasons.ts";

test("seasons follow the Aarhus calendar, including October in fall", () => {
  expect(seasonAt(Date.parse("2026-03-01T12:00:00Z"))).toBe("spring");
  expect(seasonAt(Date.parse("2026-06-01T12:00:00Z"))).toBe("summer");
  expect(seasonAt(Date.parse("2026-10-27T12:00:00Z"))).toBe("fall");
  expect(seasonAt(Date.parse("2026-12-01T12:00:00Z"))).toBe("winter");
  expect(seasonAt(Date.parse("2026-08-31T22:30:00Z"))).toBe("fall");
});
