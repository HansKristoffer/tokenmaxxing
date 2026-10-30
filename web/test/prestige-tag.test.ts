import { expect, test } from "bun:test";
import { PRESTIGE_TRACKS, prestigeTag } from "@tokenmaxxing/core/prestige.ts";
import { EMBLEM_SIZE, emblemPalette, emblemRows } from "../src/art/prestige-emblem.ts";
import { emblemDataUrl, prestigeLabelHtml } from "../src/render3d/people/prestige-label.ts";

const ranks = PRESTIGE_TRACKS.map((t) => t.rank);

test("every crest is 16x16, uses only palette keys, and is its own shape", () => {
  const seen = new Set<string>();
  for (const r of ranks) {
    const rows = emblemRows(r);
    const pal = emblemPalette(r);
    expect(rows.length, `rank ${r} height`).toBe(EMBLEM_SIZE);
    for (const [y, row] of rows.entries()) {
      expect(row.length, `rank ${r} row ${y}`).toBe(EMBLEM_SIZE);
      for (const c of row) if (c !== ".") expect(pal[c], `rank ${r} row ${y}: "${c}"`).toBeDefined();
    }
    if (r < 5) expect(pal.g).toBe(PRESTIGE_TRACKS[r - 1]!.colors.glow);
    seen.add(rows.map((row) => row.replace(/[^.]/g, "#")).join("\n"));
  }
  expect(seen.size).toBe(ranks.length);
});

test("the 3D label carries the emblem, title and run level, and is empty for no prestige", () => {
  expect(prestigeLabelHtml(0)).toBe("");
  expect(prestigeLabelHtml(9)).toBe("");
  for (const r of ranks) {
    const t = PRESTIGE_TRACKS[r - 1]!;
    const html = prestigeLabelHtml(r, 12);
    expect(html).toContain(t.name);
    expect(html).toContain(t.roman);
    expect(html).toContain("Lv12");
    expect(html).toContain(emblemDataUrl(r));
    expect(prestigeLabelHtml(r)).not.toContain("Lv");
    expect(emblemDataUrl(r).startsWith("data:image/svg+xml,")).toBe(true);
    expect(prestigeTag(r)).toContain(t.name);
  }
});
