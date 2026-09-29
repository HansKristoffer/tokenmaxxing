import { expect, test } from "bun:test";
import { clock, hoursText, minutesText, plural, secondsUntil } from "../src/format.ts";

test("clocks, durations and plurals", () => {
  expect(clock(65_000)).toBe("1:05");
  expect(clock(3_725_000)).toBe("1:02:05");
  expect(clock(-5)).toBe("0:00");
  expect(secondsUntil(1_500, 0)).toBe(2);
  expect(secondsUntil(0, 10)).toBe(0);
  expect(hoursText(0.5)).toBe("30m");
  expect(hoursText(3 + 25 / 60)).toBe("3h 25m");
  expect(minutesText(15)).toBe("15 min");
  expect(minutesText(60)).toBe("1 hour");
  expect(minutesText(1440)).toBe("24 hours");
  expect(plural(1, "game")).toBe("1 game");
  expect(plural(2, "PR")).toBe("2 PRs");
});
