import { PRESTIGE_TRACKS } from "@tokenmaxxing/core/prestige.ts";
import { EMBLEM_SIZE, emblemRows, emblemPalette } from "../../art/prestige-emblem.ts";

/**
 * The prestige tag for the 3D name label (`gear3d.ts` builds that label's HTML; this is a piece of it, not wired in
 * yet): the crest as an inline SVG data URL (no canvas, so it works in tests and as a plain `<img>`), the title in
 * the track's colour and the run level in the same `.lv` voice as the name's own level. All style is inline.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The crest as an SVG of one rect per pixel, as a `data:` URL. */
export function emblemDataUrl(rank: number): string {
  const rows = emblemRows(rank);
  const pal = emblemPalette(rank);
  let rects = "";
  for (const [y, row] of rows.entries())
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]!];
      if (c) rects += `<rect x='${x}' y='${y}' width='1' height='1' fill='${c}'/>`;
    }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${EMBLEM_SIZE}' height='${EMBLEM_SIZE}' viewBox='0 0 ${EMBLEM_SIZE} ${EMBLEM_SIZE}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The label's prestige chip, or "" for rank 0 or an unknown rank. */
export function prestigeLabelHtml(rank: number, level?: number): string {
  const t = PRESTIGE_TRACKS[rank - 1];
  if (!t) return "";
  const { main, glow } = t.colors;
  const lv = level ? ` <span style="opacity:.75;font-weight:600">· Lv${level}</span>` : "";
  return (
    `<span class="prestige-label" data-rank="${rank}" style="display:inline-flex;align-items:center;gap:4px;` +
    `padding:0 6px 0 2px;border-radius:5px;background:rgba(18,20,28,.88);border:1.5px solid ${main};` +
    `box-shadow:0 0 6px -1px ${glow};font-size:10px;font-weight:700;color:${glow}">` +
    `<img src="${emblemDataUrl(rank)}" width="14" height="14" alt="" style="image-rendering:pixelated">` +
    `${esc(t.name)} ${esc(t.roman)}${lv}</span>`
  );
}
