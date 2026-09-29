import type { Look } from "@tokenmaxxing/core/world.ts";
import { type ReactNode, useEffect, useRef } from "react";
import { characterFrame } from "../art/characters.ts";
import { hud } from "../store.ts";

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

export function Modal({ title, children, wide }: { title: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="scrim">
      <button
        type="button"
        className="backdrop"
        aria-label="Close"
        onClick={() => hud.set({ panel: null })}
      />
      <section
        className={`panel modal${wide ? " wide" : ""}`}
        role="dialog"
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
