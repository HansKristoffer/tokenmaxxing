import type { Theme } from "./themes.ts";

/**
 * Sankt Hans's own music (`FESTIVE_THEMES.sanktHans`, `themes.ts`), written for this game. The town plays a warm
 * folk waltz in G major: ten bars of 3/4 (six eighth-note steps each) and a short closing bar, with the oom-pah-pah
 * bass of a village band and a triangle lead like an accordion. The Tavern plays a quicker fiddle polka on the
 * same chords, for the singalong. Bars are written apart with `|`, which is ignored.
 */

/** G | C | D | G, then Em | C | D | G, then a turn home: a bar is `oom pah pah`, one step to the eighth. */
export const MIDSOMMER_TOWN: Theme = {
  id: "festive-sanktHans-town",
  name: "Midsommervals",
  emoji: "🔥",
  bpm: 112,
  wave: "triangle",
  lead: "d5 _ g5 a5 b5 _ | c6 _ b5 a5 g5 _ | a5 _ f#5 g5 a5 _ | g5 _ _ _ . . | e5 _ g5 a5 b5 _ | c6 _ e6 d6 c6 _ | b5 _ a5 g5 f#5 _ | g5 _ _ _ . . | c6 _ b5 a5 f#5 _ | g5 _ b5 _ d6 _ | g5 _ . .",
  bass: "g2 . d3 . b3 . | c3 . g3 . e4 . | d3 . a3 . f#3 . | g2 . d3 . b3 . | e3 . b3 . g3 . | c3 . g3 . e4 . | d3 . a3 . f#3 . | g2 . d3 . b3 . | c3 . g3 . c4 . | d3 . a3 . f#3 . | g2 . d3 .",
  drums: "k.h.h. | k.h.h. | k.h.h. | k.h.hs | k.h.h. | k.h.h. | k.h.h. | k.h.hs | k.h.h. | k.h.hs | k.h.",
};

/** The Tavern's polka: eight bars of eight, a fiddle in square-wave over the same chords. */
export const MIDSOMMER_TAVERN: Theme = {
  id: "festive-sanktHans-tavern",
  name: "Skål ved Bålet",
  emoji: "🍻",
  bpm: 150,
  wave: "square",
  lead: "g5 b5 d6 b5 g5 b5 d6 _ | c6 e6 g6 e6 c6 e6 g6 _ | a5 d6 f#6 d6 a5 d6 c6 b5 | b5 a5 g5 _ g5 _ . . | e5 g5 b5 g5 e5 g5 b5 _ | c6 b5 a5 g5 e5 g5 c6 _ | d6 _ c6 b5 a5 b5 c6 a5 | g5 _ b5 _ g5 _ . .",
  bass: "g2 . d3 . g2 . d3 . | c3 . g3 . c3 . g3 . | d3 . a3 . d3 . a3 . | g2 . d3 . g2 . d3 . | e3 . b3 . e3 . b3 . | c3 . g3 . c3 . g3 . | d3 . a3 . d3 . a3 . | g2 . d3 . g2 . . .",
  drums: "k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs | k.h.s.h. | k.h.s.h. | k.h.s.h. | k.h.s.hs",
};
