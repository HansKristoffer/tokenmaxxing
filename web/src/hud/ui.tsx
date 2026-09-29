import type { Look } from "@tokenmaxxing/core/world.ts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { house } from "../art/buildings.ts";
import { characterFrame } from "../art/characters.ts";
import { world } from "../game/world.ts";
import { errorText } from "../net.ts";
import { hud } from "../store.ts";

/**
 * Server calls from a panel: `run(fn)` makes a click or submit handler that shows a failure as
 * `error`, and ignores clicks while a call is still going (no double buys or double joins).
 */
export function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const going = useRef(false);
  const run =
    (fn: () => Promise<unknown>) =>
    async (e?: { preventDefault?: () => void }): Promise<void> => {
      e?.preventDefault?.();
      if (going.current) return;
      going.current = true;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(errorText(err));
      } finally {
        going.current = false;
        setBusy(false);
      }
    };
  return { error, busy, run };
}

/** Re-renders every `ms` while `on`, for countdowns. */
export function useTicker(ms: number, on = true): void {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms, on]);
}

/** A company's own house, in its brand's colours, as drawn in town. */
export function House({ companyId, tier, scale }: { companyId: number; tier: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = house(tier, world.companies.get(companyId)?.brand ?? null).canvas;
  const w = Math.round(sprite.width * scale);
  const h = Math.round(sprite.height * scale);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, h);
    // Whole-pixel sizes stay crisp; thumbnails are smoothed so they read instead of losing rows.
    g.imageSmoothingEnabled = scale < 1;
    g.imageSmoothingQuality = "high";
    g.drawImage(sprite, 0, 0, w, h);
  }, [sprite, w, h, scale]);
  return <canvas ref={ref} width={w} height={h} className="house-img" />;
}

/** A character drawn crisp at `scale`× (16px sprite). */
export function AvatarImage({ look, scale = 3 }: { look: Look; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 16 * scale, 16 * scale);
    g.drawImage(characterFrame(look, "down", "stand"), 0, 0, 16 * scale, 16 * scale);
  }, [look, scale]);
  return <canvas ref={ref} width={16 * scale} height={16 * scale} className="avatar" />;
}

export function Modal({
  title,
  children,
  wide,
  beside,
}: {
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Shown next to the dialog, still usable (the chat, beside a game). */
  beside?: ReactNode;
}) {
  // Focus moves into the dialog when it opens, so screen readers and Tab start there.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={`scrim${beside ? " beside" : ""}`}>
      <button
        type="button"
        className="backdrop"
        aria-label="Close"
        onClick={() => hud.set({ panel: null })}
      />
      {beside}
      <section
        ref={ref}
        tabIndex={-1}
        className={`panel modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon" aria-label="Close" onClick={() => hud.set({ panel: null })}>
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="pills">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
