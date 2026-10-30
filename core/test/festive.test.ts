import { expect, test } from "bun:test";
import {
  FESTIVE,
  FESTIVE_NPC,
  type FestiveId,
  festiveAt,
  festiveFog,
  festiveKey,
  festiveNpcOf,
  festiveWith,
  parseFestivePin,
} from "../src/festive.ts";
import { copenhagenToMs } from "../src/sky.ts";

const cph = (at: string) => copenhagenToMs(at)!;
const idAt = (at: string) => festiveAt(cph(at))?.id ?? null;

test("Halloween is 30 and 31 October", () => {
  expect(idAt("2026-10-29T23:59")).toBeNull();
  expect(idAt("2026-10-30T00:00")).toBe("halloween");
  expect(idAt("2026-10-31T23:59")).toBe("halloween");
  expect(idAt("2026-11-01T00:00")).toBeNull();
});

test("Christmas is 18 to 25 December", () => {
  expect(idAt("2026-12-17T23:59")).toBeNull();
  expect(idAt("2026-12-18T00:00")).toBe("christmas");
  expect(idAt("2026-12-25T23:59")).toBe("christmas");
  expect(idAt("2026-12-26T00:00")).toBeNull();
});

test("the other five windows", () => {
  // Sankt Hans 22-23 Jun, nytar 30 Dec-1 Jan (across the year), Easter 2027 is 28 Mar, befrielsen 4-5 May, agustusan 10-17 Aug.
  const cases: [string, string | null][] = [
    ["2026-06-21T23:59", null],
    ["2026-06-22T00:00", "sanktHans"],
    ["2026-06-23T23:59", "sanktHans"],
    ["2026-06-24T00:00", null],
    ["2026-12-29T23:59", null],
    ["2026-12-30T00:00", "nytar"],
    ["2027-01-01T23:59", "nytar"],
    ["2027-01-02T00:00", null],
    ["2027-03-20T23:59", null],
    ["2027-03-21T00:00", "paaske"],
    ["2027-03-28T12:00", "paaske"],
    ["2027-03-29T23:59", "paaske"],
    ["2027-03-30T00:00", null],
    ["2026-04-05T12:00", "paaske"],
    ["2026-05-03T23:59", null],
    ["2026-05-04T00:00", "befrielsen"],
    ["2026-05-05T23:59", "befrielsen"],
    ["2026-05-06T00:00", null],
    ["2026-08-09T23:59", null],
    ["2026-08-10T00:00", "agustusan"],
    ["2026-08-17T23:59", "agustusan"],
    ["2026-08-18T00:00", null],
  ];
  for (const [at, want] of cases) expect([at, idAt(at)]).toEqual([at, want]);
  expect(festiveAt(cph("2027-01-01T12:00"))).toMatchObject({ id: "nytar", days: 1 });
  expect(festiveAt(cph("2026-12-31T23:59"))!.intensity).toBeGreaterThan(0.99);
  expect(festiveAt(cph("2026-06-23T20:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2027-03-28T12:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2026-05-04T21:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2026-08-17T10:00"))!.intensity).toBe(1);
});

test("days are Copenhagen's, not UTC's", () => {
  const a = festiveAt(Date.UTC(2026, 9, 30, 23, 30));
  expect(a).toMatchObject({ id: "halloween", days: 0 });
  expect(festiveAt(Date.UTC(2026, 11, 17, 23, 30))?.id).toBe("christmas");
  expect(festiveAt(Date.UTC(2026, 11, 25, 23, 30))).toBeNull();
  expect(festiveAt(Date.UTC(2026, 9, 29, 23, 30))?.days).toBe(-1);
  expect(festiveAt(cph("2026-12-22T12:00"))?.days).toBe(-2);
  expect(festiveAt(cph("2026-12-25T12:00"))?.days).toBe(1);
});

test("a 23 or 25 hour day (DST) is still one day", () => {
  // Clocks went back on 2026-10-25 and forward on 2027-03-28: the windows are untouched.
  expect(idAt("2026-10-29T23:59")).toBeNull();
  expect(idAt("2027-10-30T00:00")).toBe("halloween");
  expect(idAt("2027-10-31T23:59")).toBe("halloween");
  // Easter 2027 is the day the clocks go forward (a 23 hour day).
  expect(festiveAt(cph("2027-03-28T00:00"))).toMatchObject({ id: "paaske", days: 0 });
  expect(festiveAt(cph("2027-03-28T23:59"))).toMatchObject({ id: "paaske", days: 0 });
  expect(festiveAt(cph("2027-03-29T00:00"))).toMatchObject({ id: "paaske", days: 1 });
});

test("years: any year, leap years too, the New Year between is quiet", () => {
  expect(idAt("2027-12-20T12:00")).toBe("christmas");
  expect(idAt("2027-01-03T12:00")).toBeNull();
  expect(idAt("2028-02-29T12:00")).toBeNull();
  expect(idAt("2028-12-24T12:00")).toBe("christmas");
  expect(idAt("2030-10-31T12:00")).toBe("halloween");
});

const WINDOWS = [
  ["2026-10-30T00:00", "2026-10-31T23:59"],
  ["2026-12-18T00:00", "2026-12-25T23:59"],
  ["2026-06-22T00:00", "2026-06-23T23:59"],
  ["2026-12-30T00:00", "2027-01-01T23:59"],
  ["2027-03-21T00:00", "2027-03-29T23:59"],
  ["2026-05-04T00:00", "2026-05-05T23:59"],
  ["2026-08-10T00:00", "2026-08-17T23:59"],
] as const;

test("intensity builds monotonically through each window, within (0, 1]", () => {
  const through = (from: string, to: string) => {
    const out: number[] = [];
    for (let t = cph(from); t <= cph(to); t += 10 * 60_000) {
      const f = festiveAt(t);
      expect(f).not.toBeNull();
      out.push(f!.intensity);
    }
    return out;
  };
  for (const [from, to] of WINDOWS) {
    const xs = through(from, to);
    for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...xs)).toBe(1);
  }
});

test("the ramps start and peak where the design says", () => {
  expect(festiveAt(cph("2026-10-30T00:00"))!.intensity).toBeCloseTo(0.5, 5);
  expect(festiveAt(cph("2026-10-31T16:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2026-10-31T23:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2026-12-18T00:00"))!.intensity).toBeCloseTo(0.15, 5);
  expect(festiveAt(cph("2026-12-24T18:00"))!.intensity).toBe(1);
  expect(festiveAt(cph("2026-12-25T09:00"))!.intensity).toBe(1);
});

test("intensity is continuous across midnight", () => {
  for (const [a, b] of [
    ["2026-10-30T23:59", "2026-10-31T00:00"],
    ["2026-12-20T23:59", "2026-12-21T00:00"],
  ] as const) {
    expect(Math.abs(festiveAt(cph(b))!.intensity - festiveAt(cph(a))!.intensity)).toBeLessThan(0.01);
  }
});

test("the bake key takes at most five values a window", () => {
  for (const [from, to] of WINDOWS) {
    const keys = new Set<string>();
    for (let t = cph(from); t <= cph(to); t += 5 * 60_000) keys.add(festiveKey(festiveAt(t)));
    expect(keys.size).toBeLessThanOrEqual(5);
    expect(keys.has("")).toBe(false);
  }
  expect(festiveKey(null)).toBe("");
  expect(festiveKey({ id: "halloween", intensity: 0.5, days: 0 })).toBe("halloween.2");
});

test("only Halloween brings mist, scaled by intensity", () => {
  expect(festiveFog(null)).toBe(0);
  expect(festiveFog({ id: "christmas", intensity: 1, days: 0 })).toBe(0);
  const low = festiveFog({ id: "halloween", intensity: 0.5, days: -1 });
  const high = festiveFog({ id: "halloween", intensity: 1, days: 0 });
  expect(low).toBeGreaterThan(0);
  expect(high).toBeGreaterThan(low);
  expect(high).toBeLessThanOrEqual(0.4);
  expect(festiveFog({ id: "nytar", intensity: 1, days: 0 })).toBe(0);
});

test("every theme takes a pin by name, in any case", () => {
  const now = cph("2026-01-15T12:00");
  for (const id of Object.keys(FESTIVE) as FestiveId[]) {
    for (const text of [id, id.toLowerCase(), `${id}@01-15`]) {
      const pin = parseFestivePin(text, now);
      expect(pin).toMatchObject({ id });
      expect(festiveWith(pin, now)?.id).toBe(id);
    }
  }
  expect(parseFestivePin("paaske", cph("2027-01-15T12:00"))).toEqual({
    id: "paaske",
    ms: cph("2027-03-28T12:00"),
  });
  expect(parseFestivePin("agustusan@08-17T10:00", now)).toEqual({
    id: "agustusan",
    ms: cph("2026-08-17T10:00"),
  });
});

test("pins parse", () => {
  const now = cph("2026-06-15T12:00");
  expect(parseFestivePin("off", now)).toBe("off");
  expect(parseFestivePin("christmas", now)).toEqual({ id: "christmas", ms: cph("2026-12-24T12:00") });
  expect(parseFestivePin("christmas@12-22", now)).toEqual({ id: "christmas", ms: cph("2026-12-22T12:00") });
  expect(parseFestivePin("halloween@10-31T21:00", now)).toEqual({
    id: "halloween",
    ms: cph("2026-10-31T21:00"),
  });
  expect(parseFestivePin("Halloween", now)).toEqual({ id: "halloween", ms: cph("2026-10-31T12:00") });
});

test("bad pins are null", () => {
  const now = cph("2026-06-15T12:00");
  for (const bad of [
    "",
    "foo",
    "christmas@12-32",
    "christmas@13-01",
    "christmas@12-22T25:00",
    "christmas@",
    "@12-22",
    "christmas@12-22@x",
    "constructor",
  ])
    expect(parseFestivePin(bad, now)).toBeNull();
});

test("29 February only on a leap year", () => {
  expect(parseFestivePin("halloween@02-29", cph("2028-06-01T12:00"))).toEqual({
    id: "halloween",
    ms: cph("2028-02-29T12:00"),
  });
  expect(parseFestivePin("halloween@02-29", cph("2027-06-01T12:00"))).toBeNull();
});

test("a pin beats the clock, off beats a theme, no pin follows the clock", () => {
  const summer = cph("2026-07-01T12:00");
  const pin = parseFestivePin("christmas@12-22", summer);
  expect(festiveWith(pin, summer)).toMatchObject({ id: "christmas", days: -2 });
  expect(festiveWith("off", cph("2026-10-31T21:00"))).toBeNull();
  expect(festiveWith(null, cph("2026-10-31T21:00"))?.id).toBe("halloween");
  expect(festiveWith(null, summer)).toBeNull();
  // The other theme, mid-window of its own.
  expect(festiveWith(parseFestivePin("halloween@10-31T21:00", summer), cph("2026-12-22T12:00"))?.id).toBe(
    "halloween",
  );
});

test("every def anchors on a holiday and ramps in (0, 1]", () => {
  for (const id of Object.keys(FESTIVE) as FestiveId[]) {
    const d = FESTIVE[id];
    expect(d.ramp(-1e9)).toBeGreaterThan(0);
    expect(d.ramp(1e9)).toBe(1);
  }
});

test("every theme has an NPC slot, and a filled one is a whole person", () => {
  expect(Object.keys(FESTIVE_NPC).sort()).toEqual(Object.keys(FESTIVE).sort());
  for (const npc of Object.values(FESTIVE_NPC)) {
    if (!npc) continue;
    expect(npc.name.length).toBeGreaterThan(0);
    expect(npc.lines.length).toBeGreaterThan(1);
    expect(Number.isInteger(npc.x) && Number.isInteger(npc.y)).toBe(true);
    expect(["up", "down", "left", "right"]).toContain(npc.facing);
  }
  expect(festiveNpcOf(null)).toBeNull();
});
