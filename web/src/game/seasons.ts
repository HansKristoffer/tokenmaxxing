import { type Season, seasonAt } from "@tokenmaxxing/core/seasons.ts";
import { C, rgbOf } from "../art/palette.ts";
import { skyNow } from "./sky.ts";

export const seasonNow = (): Season => seasonAt(skyNow());
const colors: Record<Season, string[]> = {
  spring: ["#9bcf76", "#79b85a", "#b9e895", "#65ac51", "#47873c", "#86ca71", "#386b30"],
  summer: [C.grass, C.grassDark, C.grassLight, C.leaf, C.leafDark, C.leafLight, C.leafInk],
  fall: ["#b5ad60", "#928e4c", "#d0c477", "#c27639", "#9a502d", "#e4a649", "#73432c"],
  winter: ["#9cae88", "#819570", "#b5c7a0", "#69835f", "#50694c", "#8ca281", "#3d583c"],
};
const source = [C.grass, C.grassDark, C.grassLight, C.leaf, C.leafDark, C.leafLight, C.leafInk].map(rgbOf);
const cache = new WeakMap<HTMLCanvasElement, Map<Season, HTMLCanvasElement>>();
/** A palette-swapped twin of a town tree or ground canvas. */
export function seasonalCanvas(src: HTMLCanvasElement, season: Season): HTMLCanvasElement {
  if (season === "summer") return src;
  const twins = cache.get(src) ?? new Map<Season, HTMLCanvasElement>();
  cache.set(src, twins);
  const existing = twins.get(season);
  if (existing) return existing;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const g = out.getContext("2d")!;
  g.drawImage(src, 0, 0);
  const image = g.getImageData(0, 0, out.width, out.height);
  const targets = colors[season].map(rgbOf);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = source.findIndex(
      ([r, gr, b]) => r === image.data[i] && gr === image.data[i + 1] && b === image.data[i + 2],
    );
    if (n >= 0) image.data.set(targets[n]!, i);
  }
  g.putImageData(image, 0, 0);
  twins.set(season, out);
  return out;
}
