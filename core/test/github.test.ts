import { expect, test } from "bun:test";
import { fetchPullRequests, type GhRunner, githubAccounts } from "../src/sources/github.ts";

const me = { host: "github.com", login: "me", token: "t" };

const pr = (n: number) => ({
  html_url: `https://github.com/acme/secret/pull/${n}`,
  created_at: new Date(Date.UTC(2026, 0, 1) + n * 1000).toISOString().replace(".000", ""),
});

/** GitHub search over `all`: 100 a page, at most 1000 a query, `created:>=` honoured. */
function searchApi(all: ReturnType<typeof pr>[], calls: URL[]) {
  return (async (raw: string) => {
    const url = new URL(raw);
    calls.push(url);
    const since = url.searchParams.get("q")!.match(/created:>=(\S+)/)?.[1];
    const from = (since ? all.filter((p) => p.created_at >= since) : all).slice(0, 1000);
    const page = Number(url.searchParams.get("page"));
    return Response.json({ items: from.slice((page - 1) * 100, page * 100) });
  }) as unknown as typeof fetch;
}

test("pages past the 1000-result search cap and never sends the URL", async () => {
  const all = Array.from({ length: 1500 }, (_, i) => pr(i));
  const calls: URL[] = [];
  const r = await fetchPullRequests(me, null, searchApi(all, calls));
  // 10 pages, then 6 more from the 1000th PR on.
  expect(calls).toHaveLength(16);
  expect(calls[10]!.searchParams.get("q")).toBe(`is:pr author:@me created:>=${all[999]!.created_at}`);
  // The query boundary PR is fetched twice; the server's dedup index drops it.
  expect(new Set(r.events.map((e) => e.messageId)).size).toBe(1500);
  expect(r.since).toBe(all[1499]!.created_at);
  expect(r.events[0]).toMatchObject({ source: "github", messageType: "pr", inputTokens: 0 });
  expect(JSON.stringify(r.events)).not.toContain("acme");
});

test("no new PRs keeps the cursor; Enterprise hosts use their own API", async () => {
  const calls: URL[] = [];
  const r = await fetchPullRequests(
    { ...me, host: "ghe.acme.com" },
    "2026-09-01T00:00:00Z",
    searchApi([], calls),
  );
  expect(r).toEqual({ events: [], since: "2026-09-01T00:00:00Z" });
  expect(calls[0]!.origin + calls[0]!.pathname).toBe("https://ghe.acme.com/api/v3/search/issues");
});

test("a rate limit keeps what was fetched and resumes from it", async () => {
  const all = Array.from({ length: 300 }, (_, i) => pr(i));
  const search = searchApi(all, []);
  let n = 0;
  const limited = (async (url: string) =>
    ++n > 2 ? new Response("", { status: 403 }) : search(url)) as unknown as typeof fetch;
  const r = await fetchPullRequests(me, null, limited);
  expect(r.events).toHaveLength(200);
  expect(r.since).toBe(all[199]!.created_at);
});

test("a rejected token is reported, not thrown", async () => {
  const r = await fetchPullRequests(
    me,
    null,
    (async () => new Response("", { status: 401 })) as unknown as typeof fetch,
  );
  expect(r).toEqual({ events: [], since: null, rejected: true });
});

test("every gh account on every host, even when one of them is broken", async () => {
  const hosts = {
    "github.com": [
      { state: "success", login: "me" },
      { state: "error", login: "expired" },
    ],
    "ghe.acme.com": [{ state: "success", login: "me-at-work" }],
  };
  const gh: GhRunner = async (args) =>
    args[1] === "status"
      ? { ok: false, out: JSON.stringify({ hosts }) }
      : { ok: true, out: `token-${args[args.length - 1]}\n` };
  expect(await githubAccounts(gh, async () => null)).toEqual([
    { host: "github.com", login: "me", token: "token-me" },
    { host: "ghe.acme.com", login: "me-at-work", token: "token-me-at-work" },
  ]);
});

test("without gh, git's saved login; with neither, why", async () => {
  const saved = { host: "github.com", login: "me", token: "gho_x" };
  expect(await githubAccounts(null, async () => saved)).toEqual([saved]);
  expect(await githubAccounts(null, async () => null)).toBe("no_gh");
  const signedOut: GhRunner = async () => ({ ok: false, out: JSON.stringify({ hosts: {} }) });
  expect(await githubAccounts(signedOut, async () => null)).toBe("signed_out");
});
