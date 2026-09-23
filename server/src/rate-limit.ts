/**
 * Fixed-window counter per key (client IP).
 * ponytail: in-memory, so it resets on deploy and only covers one instance.
 * Fine for a single Railway replica; move to SQLite if we ever scale out.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** True when the request is allowed. */
  take(key: string, now: number): boolean {
    const h = this.hits.get(key);
    if (!h || h.resetAt <= now) {
      if (this.hits.size > 10_000) this.sweep(now);
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    h.count++;
    return h.count <= this.limit;
  }

  private sweep(now: number): void {
    for (const [k, h] of this.hits) if (h.resetAt <= now) this.hits.delete(k);
  }
}
