import { useEffect, useState } from "react";

export interface Poll<T> {
  data: T | undefined;
  error: unknown;
  /** Refetches now, for use after a mutation has changed the data. */
  reload: () => void;
}

/**
 * Loads `fetcher` now, whenever `deps` change, and every `intervalMs` while
 * the tab is visible. Keeps the previous data on screen during reloads.
 */
export function usePoll<T>(fetcher: () => Promise<T>, deps: unknown[], intervalMs = 60_000): Poll<T> {
  const [state, setState] = useState<Omit<Poll<T>, "reload">>({ data: undefined, error: undefined });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(deps);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for the caller's deps
  useEffect(() => {
    let live = true;
    const load = () =>
      fetcher().then(
        (data) => live && setState({ data, error: undefined }),
        (error: unknown) => live && setState((s) => ({ ...s, error })),
      );
    void load();
    const id = setInterval(() => document.visibilityState === "visible" && void load(), intervalMs);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [key, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
