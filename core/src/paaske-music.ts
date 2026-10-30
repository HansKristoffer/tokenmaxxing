import type { Theme } from "./themes.ts";

/**
 * Påske's music (`FESTIVE_THEMES.paaske`, registered in `themes.ts`), written for this game: the town's a light, bouncy
 * spring tune in G major on a soft triangle wave, birdcall figures climbing over an oom-pah bass; the Tavern's a quick
 * D major polka on the square wave for the påskefrokost. Two parts of four bars each, `THEME_STEPS` long.
 */
export const PAASKE_TOWN: Theme = {
  id: "festive-paaske-town",
  name: "Påskeliljer",
  emoji: "🐣",
  bpm: 132,
  wave: "triangle",
  lead: "g5 _ b5 d6 b5 g5 a5 _ | b5 _ d6 g6 d6 b5 a5 . | e5 g5 b5 e6 d6 b5 g5 _ | a5 b5 a5 f#5 d5 _ . . | d6 _ d6 e6 d6 b5 g5 _ | e6 _ e6 f#6 e6 c6 a5 _ | b5 d6 g6 _ f#6 e6 d6 b5 | g5 _ b5 _ g5 _ . .",
  bass: "g2 . d3 . g3 . d3 . | g2 . d3 . g3 . d3 . | c3 . g3 . c3 . g3 . | d3 . a3 . d3 . a3 . | g2 . d3 . g3 . d3 . | a2 . e3 . a2 . e3 . | g2 . d3 . a2 . d3 . | g2 . d3 . g2 . . .",
  drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hh | k.hhs.hh | k.hhs.hh | k.hhs.hh | k.h.s.hs",
};

export const PAASKE_TAVERN: Theme = {
  id: "festive-paaske-tavern",
  name: "Påskefrokost Polka",
  emoji: "🥚",
  bpm: 152,
  wave: "square",
  lead: "d5 f#5 a5 f#5 d5 f#5 a5 _ | g5 f#5 e5 d5 e5 g5 b5 _ | a5 g5 f#5 e5 f#5 a5 d6 a5 | e5 d5 c#5 e5 d5 _ . . | f#5 _ a5 _ d6 _ c#6 a5 | b5 _ a5 _ g5 _ f#5 e5 | d5 f#5 a5 d6 c#6 a5 f#5 a5 | g5 f#5 e5 c#5 d5 _ _ _",
  bass: "d3 . a3 . d3 . a3 . | g2 . d3 . g2 . d3 . | d3 . a3 . a2 . e3 . | a2 . e3 . d3 . . . | d3 . a3 . d3 . a3 . | g2 . d3 . a2 . e3 . | d3 . a3 . d3 . a3 . | g2 . a2 . d3 . . .",
  drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.hks.hs",
};
