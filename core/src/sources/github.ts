import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { TokenEvent } from "../types.ts";

/** A GUI app starts with a bare PATH, so look where Homebrew puts `gh`. */
const GH_PATHS = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"];

/** GitHub search returns at most this many results per query. */
const SEARCH_CAP = 1000;

export const ghPath = (): string | null => GH_PATHS.find((p) => existsSync(p)) ?? Bun.which("gh");

/** Runs `gh` and returns stdout; throws on a non-zero exit. */
export type GhRunner = (args: string[]) => Promise<string>;

export function ghRunner(gh: string): GhRunner {
  return async (args) => {
    const p = Bun.spawn([gh, ...args], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1" },
    });
    const [out, err, code] = await Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited,
    ]);
    if (code !== 0) throw new Error(`gh exited ${code}: ${err.trim().slice(0, 200)}`);
    return out;
  };
}

/**
 * PRs the `gh` user created at or after `since` (ISO time; null = all time),
 * as zero-token `pr` events. Only a hash of the PR URL leaves the Mac, so repo
 * names stay private; the server dedups on it. `since` is the newest
 * `createdAt` seen, for the next run.
 */
export async function fetchPullRequests(
  run: GhRunner,
  since: string | null,
): Promise<{ events: TokenEvent[]; since: string | null }> {
  const events: TokenEvent[] = [];
  for (;;) {
    const args = ["search", "prs", "--author=@me", "--sort=created", "--order=asc", `--limit=${SEARCH_CAP}`];
    if (since) args.push(`--created=>=${since}`);
    const prs = JSON.parse(await run([...args, "--json=url,createdAt"])) as {
      url: string;
      createdAt: string;
    }[];
    for (const pr of prs) {
      const timestamp = Date.parse(pr.createdAt);
      if (!Number.isFinite(timestamp)) continue;
      events.push({
        source: "github",
        sessionId: "github",
        agentId: null,
        messageId: createHash("sha256").update(pr.url).digest("hex"),
        requestId: null,
        timestamp,
        model: "",
        messageType: "pr",
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: null,
      });
    }
    const last = prs.at(-1)?.createdAt ?? since;
    // A full page means more remain: page on from the newest one. `>=` re-reads
    // it, which the dedup drops; if it didn't advance, stop rather than loop.
    if (prs.length < SEARCH_CAP || last === since) return { events, since: last };
    since = last;
  }
}
