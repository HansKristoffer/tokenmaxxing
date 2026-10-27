import { type Launch, launchesFrom, OPENROUTER_MODELS } from "@tokenmaxxing/core/launch.ts";

/** One read for the whole world, not per player: OpenRouter's model list (~800 KB) every 10 minutes. */
export const LAUNCHES_EVERY_MS = 10 * 60_000;
const TIMEOUT_MS = 15_000;

/**
 * The launches OpenRouter's list says are recent at `now`, or `prev` when it can't be read (offline,
 * an error page, a list that changed shape), so a bad read never takes a stand down.
 * `LAUNCH_FEED=off` is the kill switch for a feed gone wrong: no launches at all.
 */
export async function checkLaunches(
  prev: Launch[],
  now: number,
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<Launch[]> {
  if (env.LAUNCH_FEED?.trim().toLowerCase() === "off") return [];
  try {
    const res = await fetcher(OPENROUTER_MODELS, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return (res.ok && launchesFrom(await res.json(), now)) || prev;
  } catch {
    return prev;
  }
}
