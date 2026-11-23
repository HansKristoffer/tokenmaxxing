import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { type CSSProperties, useEffect, useRef } from "react";
import { EMBLEM_SIZE, emblemFrames, emblemSprite } from "../art/prestige-emblem.ts";

/** The crest on a canvas; the top track plays its glint frames (not under reduced motion). */
function Emblem({ rank, px }: { rank: number; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    g.imageSmoothingEnabled = false;
    const draw = (src: HTMLCanvasElement) => {
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(src, 0, 0, cv.width, cv.height);
    };
    draw(emblemSprite(rank));

    // Only the top track has glint frames, and a reader who asks for reduced motion gets none.
    const isTopTrack = rank >= PRESTIGE_TRACKS.length;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isTopTrack || reducedMotion) return;

    const frames = emblemFrames(rank);
    let i = 0;
    const id = setInterval(() => {
      // 16 steps: the glint frames, then the plain crest for the rest of the cycle.
      i = (i + 1) % 16;
      draw(frames[i] ?? emblemSprite(rank));
    }, 130);
    return () => clearInterval(id);
  }, [rank]);
  return (
    <canvas
      ref={ref}
      className="pt-emblem"
      width={EMBLEM_SIZE}
      height={EMBLEM_SIZE}
      style={{ width: px, height: px }}
    />
  );
}

/**
 * A prestige tag: crest, title and (optionally) the run level, styled in the track's colours. Sits beside the
 * milestone title (`.milestone-title`). Renders nothing for rank 0 (never prestiged) or an unknown rank.
 */
export function PrestigeTag({ rank, level, size = 20 }: { rank: number; level?: number; size?: number }) {
  const t = PRESTIGE_TRACKS[rank - 1];
  if (!t) return null;

  const runPart = level !== undefined ? ` · run level ${level}` : "";
  // Custom properties are not in CSSProperties, so the object is cast to it.
  const style = {
    "--pt-main": t.colors.main,
    "--pt-accent": t.colors.accent,
    "--pt-glow": t.colors.glow,
    fontSize: Math.round(size * 0.6),
  } as CSSProperties;
  return (
    <p
      className={`prestige-tag pt-${t.key}`}
      title={`Prestige ${t.roman} · ${t.name}${runPart}`}
      style={style}
    >
      <Emblem rank={rank} px={size} />
      <span className="pt-title">{t.name}</span>
      <span className="pt-roman">{t.roman}</span>
      {level !== undefined ? <span className="pt-lv">· Lv{level}</span> : null}
    </p>
  );
}
