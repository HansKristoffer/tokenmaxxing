import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { emblemDataUrl } from "../render3d/people/prestige-label.ts";

/** A crest and the roman numeral, small enough to sit in a list row beside a name. Nothing for rank 0. */
export function PrestigeMini({ rank, px = 12 }: { rank: number; px?: number }) {
  const t = PRESTIGE_TRACKS[rank - 1];
  if (!t) return null;
  return (
    <span
      className="prestige-mini"
      title={`Prestige ${t.roman} · ${t.name}`}
      style={{ color: t.colors.glow, fontWeight: 700, whiteSpace: "nowrap" }}
    >
      <img
        src={emblemDataUrl(rank)}
        width={px}
        height={px}
        alt=""
        style={{ imageRendering: "pixelated", verticalAlign: "-2px", marginRight: 2 }}
      />
      {t.roman}
    </span>
  );
}
