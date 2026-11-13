import { IDLE_MS } from "@tokenmaxxing/core/world.ts";

/** With nothing going on in the picture, this long without input drops it to the quiet rate. */
const QUIET_MS = 10_000;
/** The quiet rate, in frames a second. */
const QUIET_FPS = 30;

/** Schedules visible simulation and drawing without treating intentional idle gaps as missed frames. */
export class FrameCadence {
  private nextAt = 0;
  private lastAt: number | null = null;
  private inputAt = 0;
  private rate = -1;

  wake(now: number): void {
    this.inputAt = now;
  }

  step(
    now: number,
    fpsCap: 0 | 30 | 60,
    busy: boolean,
    hidden: boolean,
  ): { idle: boolean; gap: number } | null {
    if (hidden) {
      this.lastAt = null;
      this.nextAt = 0;
      return null;
    }
    // A busy picture keeps its rate while someone is at it. Once they have dozed off (`IDLE_MS` without input,
    // as the world counts it) nobody is: a town left open on a second screen runs at the quiet rate too.
    const idle = now - this.inputAt > (busy ? IDLE_MS : QUIET_MS);
    const rate = idle ? QUIET_FPS : fpsCap;
    if (rate !== this.rate) this.nextAt = 0;
    this.rate = rate;
    if (now + 0.1 < this.nextAt) return null;
    const gap = this.lastAt === null ? 0 : now - this.lastAt;
    this.lastAt = now;
    const interval = rate === 0 ? 0 : 1000 / rate;
    if (now - this.nextAt >= interval) this.nextAt = now;
    this.nextAt += interval;
    return { idle, gap };
  }
}
