import { describe, expect, test } from "bun:test";
import { STATUS_PAGES } from "@tokenmaxxing/core/picnic.ts";
import { checkOutage, forced } from "../src/picnic.ts";
import { markPicnic, picnicsOf } from "../src/town/picnic.ts";
import { migrate } from "../src/town/schema.ts";
import { memorySql } from "./memory-sql.ts";

/** A fetch that answers each status page from `pages` (a URL missing from it fails). */
const pages = (replies: Record<string, unknown>, ok = true) =>
  (async (url: string) => {
    if (!(url in replies)) throw new Error("offline");
    return { ok, json: async () => replies[url] };
  }) as unknown as typeof fetch;

const indicator = (i: string) => ({ status: { indicator: i }, components: [] });

describe("checkOutage", () => {
  test("reads both pages: one fetch round for the whole world", async () => {
    const seen: string[] = [];
    const fetcher = (async (url: string) => {
      seen.push(url);
      return { ok: true, json: async () => indicator(url === STATUS_PAGES.Claude ? "major" : "none") };
    }) as unknown as typeof fetch;
    expect(await checkOutage(null, 10, fetcher)).toEqual({ down: ["Claude"], since: 10 });
    expect(seen.sort()).toEqual(Object.values(STATUS_PAGES).sort());
  });

  test("all clear is no outage", async () => {
    const fine = pages({
      [STATUS_PAGES.Claude]: indicator("none"),
      [STATUS_PAGES.OpenAI]: indicator("minor"),
    });
    expect(await checkOutage(null, 10, fine)).toBeNull();
  });

  test("failed requests and odd replies keep the last answer", async () => {
    const prev = { down: ["OpenAI" as const], since: 5 };
    expect(await checkOutage(prev, 10, pages({}))).toEqual(prev);
    expect(await checkOutage(prev, 10, pages({ [STATUS_PAGES.OpenAI]: {} }, false))).toEqual(prev);
    expect(await checkOutage(prev, 10, pages({ [STATUS_PAGES.OpenAI]: "<html>" }))).toEqual(prev);
    expect(await checkOutage(null, 10, pages({}))).toBeNull();
  });
});

test("PICNIC_OUTAGE forces it, or turns it off", () => {
  expect(forced(1, { PICNIC_OUTAGE: "claude" })).toEqual({ down: ["Claude"], since: 1 });
  expect(forced(1, { PICNIC_OUTAGE: "off" })).toBeNull();
  expect(forced(1, {})).toBeUndefined();
});

test("the badge comes once per outage, and counts outages", async () => {
  const { sql } = memorySql();
  await migrate(sql);
  expect(await markPicnic(sql, 1, 1000)).toBe(true);
  expect(await markPicnic(sql, 1, 1000)).toBe(false);
  expect(await markPicnic(sql, 2, 1000)).toBe(true);
  expect(await markPicnic(sql, 1, 9000)).toBe(true);
  expect(await picnicsOf(sql, 1)).toBe(2);
  expect(await picnicsOf(sql, 3)).toBe(0);
});
