import { expect, test } from "bun:test";
import { BRIEFS, HEADLINES, headlines, type PaperFacts, paper } from "../src/paper.ts";

const QUIET: PaperFacts = {
  day: "2026-10-20",
  tokens: 0,
  people: 0,
  burner: null,
  company: null,
  prs: 0,
  shipper: null,
  prompts: 0,
  model: null,
  pet: null,
  game: null,
  trend: { prev: 0, week: 0, prevWeek: 0, month: 0, prevMonth: 0, best: 0, streak: null },
  cache: 0,
  turns: 0,
  models: 0,
  agents: null,
  talker: null,
  newcomer: null,
  comeback: null,
  marathon: null,
  light: null,
};

const BUSY: PaperFacts = {
  ...QUIET,
  tokens: 9_300_000_000,
  people: 7,
  burner: { name: "ada", tokens: 4_100_000_000 },
  company: { name: "ACME", tokens: 6_000_000_000, members: 3 },
  prs: 23,
  shipper: { name: "bo", prs: 9 },
  prompts: 812,
  model: { name: "claude-opus-4-1", tokens: 5e9 },
  pet: { owner: "cy", pet: "Duck", place: "the Inn" },
  game: { name: "dee", game: "Hype Cycle", won: 140 },
  trend: {
    prev: 6_000_000_000,
    week: 40e9,
    prevWeek: 30e9,
    month: 120e9,
    prevMonth: 150e9,
    best: 9e9,
    streak: { name: "ada", days: 4 },
  },
  cache: 0.8,
  turns: 5000,
  models: 3,
  agents: { name: "ed", peak: 6 },
  talker: { name: "fay", prompts: 300 },
  newcomer: "gus",
  comeback: "hal",
  marathon: { name: "ivy", days: 12 },
  light: { name: "jo", tokens: 12_000 },
};

test("a busy day leads with the biggest burner, filled in", () => {
  const front = headlines(BUSY);
  expect(front).toHaveLength(HEADLINES);
  expect(front[0]!.title).toContain("ada");
  expect(front[0]!.title).toMatch(/4\.1B/);
  for (const h of front) expect(`${h.title} ${h.deck}`).not.toMatch(/[{}]/);
});

test("the same day reads the same; another day can read differently", () => {
  expect(headlines(BUSY)).toEqual(headlines(BUSY));
  const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 10).padStart(2, "0")}`);
  const fronts = new Set(days.map((day) => JSON.stringify(headlines({ ...BUSY, day }))));
  expect(fronts.size).toBeGreaterThan(1);
});

test("a quiet day still fills the front page, with no stories about nothing", () => {
  const front = headlines(QUIET);
  expect(front).toHaveLength(HEADLINES);
  expect(new Set(front.map((h) => h.title)).size).toBe(HEADLINES);
  expect(front.some((h) => h.title.includes("burns"))).toBe(false);
});

test("a pet sighting names its owner and the place", () => {
  const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  const pets = days
    .flatMap((day) => headlines({ ...QUIET, day, pet: BUSY.pet }))
    .filter((h) => /Duck/.test(h.title));
  expect(pets.length).toBeGreaterThan(0);
  for (const h of pets) expect(`${h.title} ${h.deck}`).toMatch(/cy/);
  for (const h of pets) expect(`${h.title} ${h.deck}`).toMatch(/the Inn/);
});

test("the paper chains the day onto the weeks and months before it", () => {
  const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  const text = days.flatMap((day) => headlines({ ...BUSY, day })).map((h) => `${h.title} ${h.deck}`).join("\n");
  expect(text).toMatch(/last week|day before|Month by month|days running|record/i);
  const { markets } = paper(BUSY);
  expect(markets.map((m) => m.label)).toEqual(["Day", "7 days", "30 days", "Cache"]);
  expect(markets[0]!.change).toBeCloseTo(9.3 / 6 - 1);
  expect(markets[1]!.change).toBeCloseTo(40 / 30 - 1);
  expect(markets[2]!.change).toBeCloseTo(120 / 150 - 1);
  expect(markets[3]!.value).toBe("80%");
});

test("a record day is a story", () => {
  const record = { ...BUSY, tokens: 20e9 };
  const days = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
  expect(days.some((day) => headlines({ ...record, day }).some((h) => /record|all-time/i.test(h.title)))).toBe(
    true,
  );
});

test("the page has briefs, a forecast and two different corners, and no holes", () => {
  for (const facts of [QUIET, BUSY, { ...BUSY, day: "2026-12-24" }]) {
    const p = paper(facts);
    expect(p.briefs).toHaveLength(BRIEFS);
    expect(p.forecast.length).toBeGreaterThan(0);
    expect(p.corners).toHaveLength(2);
    expect(p.corners[0]!.kicker).not.toBe(p.corners[1]!.kicker);
    expect(new Set(p.headlines.map((h) => h.title)).size).toBe(HEADLINES);
    const text = [
      ...p.headlines.flatMap((h) => [h.title, h.deck]),
      ...p.briefs,
      p.forecast,
      ...p.corners.flatMap((c) => [c.kicker, c.text]),
      ...p.markets.flatMap((m) => [m.label, m.value]),
    ].join("\n");
    expect(text).not.toMatch(/[{}]|undefined|NaN/);
  }
});

test("the same day reads the same page", () => {
  expect(paper(BUSY)).toEqual(paper(BUSY));
});
