import { expect, test } from "bun:test";
import { fetchPullRequests } from "../src/sources/github.ts";

const pr = (n: number) => ({
  url: `https://github.com/acme/secret/pull/${n}`,
  createdAt: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString().replace(".000", ""),
});

test("pages past the 1000-result search cap and never sends the URL", async () => {
  const all = Array.from({ length: 1500 }, (_, i) => pr(i));
  const calls: string[][] = [];
  const run = async (args: string[]) => {
    calls.push(args);
    const since = args.find((a) => a.startsWith("--created=>="))?.slice(12);
    const from = since ? all.filter((p) => p.createdAt >= since) : all;
    return JSON.stringify(from.slice(0, 1000));
  };

  const r = await fetchPullRequests(run, null);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toContain(`--created=>=${all[999]!.createdAt}`);
  // The page boundary PR is fetched twice; the server's dedup index drops it.
  expect(new Set(r.events.map((e) => e.messageId)).size).toBe(1500);
  expect(r.since).toBe(all[1499]!.createdAt);
  expect(r.events[0]).toMatchObject({ source: "github", messageType: "pr", inputTokens: 0 });
  expect(JSON.stringify(r.events)).not.toContain("acme");
});

test("no new PRs keeps the cursor", async () => {
  const r = await fetchPullRequests(async () => "[]", "2026-09-01T00:00:00Z");
  expect(r).toEqual({ events: [], since: "2026-09-01T00:00:00Z" });
});
